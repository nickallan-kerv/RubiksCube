import {
  BufferGeometry,
  MOUSE,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
  type Intersection,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createMove, type CubeMove, type FaceName, type TurnDirection } from '../domain/cubeNotation'

interface DragStart {
  clientX: number
  clientY: number
  face: FaceName
  lockedScreenIntent: ScreenIntent | null
  dimension: number
  x: number
  y: number
  z: number
  faceNormalWorld: Vector3
  cubeWorldQuaternionInverse: Quaternion
  layer: number
}

export interface InteractionDebugSnapshot {
  phase: 'blocked' | 'down' | 'drag' | 'up' | 'ignored' | 'cancel'
  face?: FaceName
  layer?: number
  x?: number
  y?: number
  z?: number
  deltaX?: number
  deltaY?: number
  direction?: TurnDirection
  dragAxis?: Axis
  rotationAxis?: Axis
  rotationSign?: 1 | -1
  faceKey?: FaceKey
  thresholdPx?: number
}

interface DragTurnMove {
  face: FaceName
  direction: TurnDirection
  layer: number
}

interface DragTurnResolution {
  move: DragTurnMove
  dragAxis: Axis
  rotationAxis: Axis
  rotationSign: 1 | -1
  faceKey: FaceKey
}

const DRAG_THRESHOLD_PX = 10
const AXIS_TOLERANCE = 0.001
const INTENT_DOMINANCE_RATIO = 1.2

type ScreenIntent = 'horizontal' | 'vertical'

type Axis = 'x' | 'y' | 'z'
type FaceKey = 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-'

const DRAG_ROTATION_SIGN: Record<FaceKey, Record<Axis, 1 | -1 | undefined>> = {
  'x+': { x: undefined, y: 1, z: -1 },
  'x-': { x: undefined, y: -1, z: 1 },
  'y+': { x: -1, y: undefined, z: 1 },
  'y-': { x: 1, y: undefined, z: -1 },
  'z+': { x: 1, y: -1, z: undefined },
  'z-': { x: -1, y: 1, z: undefined },
}

export class FaceTurnInteractionController {
  private readonly canvas: HTMLCanvasElement
  private readonly camera: PerspectiveCamera
  private readonly getTurnTargets: () => Mesh[]
  private readonly onFaceTurn: (move: CubeMove) => void
  private readonly canStartTurn: () => boolean
  private readonly onDebug: ((snapshot: InteractionDebugSnapshot) => void) | null
  private readonly requestRender: () => void
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly controls: OrbitControls
  private dragStart: DragStart | null = null

  public constructor(
    canvas: HTMLCanvasElement,
    camera: PerspectiveCamera,
    getTurnTargets: () => Mesh[],
    onFaceTurn: (move: CubeMove) => void,
    canStartTurn: () => boolean,
    onDebug: ((snapshot: InteractionDebugSnapshot) => void) | null,
    requestRender: () => void,
  ) {
    this.canvas = canvas
    this.camera = camera
    this.getTurnTargets = getTurnTargets
    this.onFaceTurn = onFaceTurn
    this.canStartTurn = canStartTurn
    this.onDebug = onDebug
    this.requestRender = requestRender

    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = false
    this.controls.enablePan = false
    this.controls.mouseButtons.LEFT = null
    this.controls.mouseButtons.RIGHT = null
    this.controls.mouseButtons.MIDDLE = MOUSE.ROTATE
    this.controls.addEventListener('change', () => this.requestRender())

    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('pointerleave', this.handlePointerCancel)
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel)
  }

  public dispose(): void {
    this.controls.dispose()
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointerleave', this.handlePointerCancel)
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel)
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return
    }

    if (!this.canStartTurn()) {
      this.dragStart = null
      this.onDebug?.({ phase: 'blocked' })
      return
    }

    const intersection = this.getIntersection(event.clientX, event.clientY)
    if (!intersection) {
      this.dragStart = null
      this.onDebug?.({ phase: 'cancel' })
      return
    }

    const face = this.extractFaceFromIntersection(intersection)

    this.dragStart = {
      clientX: event.clientX,
      clientY: event.clientY,
      face,
      lockedScreenIntent: null,
      ...this.extractFaceCoordinateFromIntersection(intersection),
      faceNormalWorld: this.extractFaceNormalWorld(intersection),
      cubeWorldQuaternionInverse: this.extractCubeWorldQuaternionInverse(intersection),
      layer: 0,
    }

    this.onDebug?.({
      phase: 'down',
      face: this.dragStart.face,
      layer: this.dragStart.layer,
      x: this.dragStart.x,
      y: this.dragStart.y,
      z: this.dragStart.z,
    })
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragStart || event.button !== 0) {
      this.dragStart = null
      this.onDebug?.({ phase: 'cancel' })
      return
    }

    const start = this.dragStart

    const deltaX = event.clientX - start.clientX
    const deltaY = event.clientY - start.clientY
    this.dragStart = null

    if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
      this.onDebug?.({
        phase: 'ignored',
        face: start.face,
        layer: start.layer,
        x: start.x,
        y: start.y,
        z: start.z,
        deltaX,
        deltaY,
        thresholdPx: DRAG_THRESHOLD_PX,
      })
      return
    }

    const finalScreenIntent = classifyScreenIntent(deltaX, deltaY)
    const inferredIntent = finalScreenIntent ?? start.lockedScreenIntent
    const resolution = resolveDragTurnMove(start, this.camera, deltaX, deltaY, inferredIntent)
    const resolvedMove = resolution?.move ?? inferDragTurnMove(start.face, deltaX, deltaY)
    const move = createMove(resolvedMove.face, resolvedMove.layer, resolvedMove.direction)
    this.onDebug?.({
      phase: 'up',
      face: resolvedMove.face,
      layer: resolvedMove.layer,
      x: start.x,
      y: start.y,
      z: start.z,
      deltaX,
      deltaY,
      direction: resolvedMove.direction,
      dragAxis: resolution?.dragAxis,
      rotationAxis: resolution?.rotationAxis,
      rotationSign: resolution?.rotationSign,
      faceKey: resolution?.faceKey,
      thresholdPx: DRAG_THRESHOLD_PX,
    })
    this.onFaceTurn(move)
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragStart) {
      return
    }

    const deltaX = event.clientX - this.dragStart.clientX
    const deltaY = event.clientY - this.dragStart.clientY

    if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
      this.onDebug?.({
        phase: 'drag',
        face: this.dragStart.face,
        layer: this.dragStart.layer,
        x: this.dragStart.x,
        y: this.dragStart.y,
        z: this.dragStart.z,
        deltaX,
        deltaY,
        thresholdPx: DRAG_THRESHOLD_PX,
      })
      return
    }

    const inferredIntent = this.dragStart.lockedScreenIntent ?? classifyScreenIntent(deltaX, deltaY)
    if (!this.dragStart.lockedScreenIntent && inferredIntent) {
      this.dragStart.lockedScreenIntent = inferredIntent
    }

    const resolution = resolveDragTurnMove(this.dragStart, this.camera, deltaX, deltaY, inferredIntent)
    const resolvedMove = resolution?.move ?? inferDragTurnMove(this.dragStart.face, deltaX, deltaY)

    this.onDebug?.({
      phase: 'drag',
      face: resolvedMove.face,
      layer: resolvedMove.layer,
      x: this.dragStart.x,
      y: this.dragStart.y,
      z: this.dragStart.z,
      deltaX,
      deltaY,
      direction: resolvedMove.direction,
      dragAxis: resolution?.dragAxis,
      rotationAxis: resolution?.rotationAxis,
      rotationSign: resolution?.rotationSign,
      faceKey: resolution?.faceKey,
      thresholdPx: DRAG_THRESHOLD_PX,
    })
  }

  private handlePointerCancel = (): void => {
    this.dragStart = null
    this.onDebug?.({ phase: 'cancel' })
  }

  private getIntersection(clientX: number, clientY: number): Intersection<Object3D> | null {
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.pointer.set(x, y)

    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersections = this.raycaster.intersectObjects(this.getTurnTargets(), false)
    return intersections[0] ?? null
  }

  private extractFaceFromIntersection(intersection: Intersection<Object3D>): FaceName {
    const materialFace = this.extractFaceFromMaterialIndex(intersection)
    if (materialFace) {
      return materialFace
    }

    const faceNormal = intersection.face?.normal
    if (!faceNormal) {
      return 'F'
    }

    // Use cubie-local normal so face mapping is stable even when the cube group is rotated for presentation.
    const absX = Math.abs(faceNormal.x)
    const absY = Math.abs(faceNormal.y)
    const absZ = Math.abs(faceNormal.z)

    if (absX >= absY && absX >= absZ) {
      return faceNormal.x >= 0 ? 'R' : 'L'
    }

    if (absY >= absX && absY >= absZ) {
      return faceNormal.y >= 0 ? 'U' : 'D'
    }

    return faceNormal.z >= 0 ? 'F' : 'B'
  }

  private extractFaceFromMaterialIndex(intersection: Intersection<Object3D>): FaceName | null {
    const mesh = intersection.object as Mesh
    const geometry = mesh.geometry
    if (!(geometry instanceof BufferGeometry) || intersection.faceIndex === undefined || intersection.faceIndex === null) {
      return null
    }

    const triangleStart = intersection.faceIndex * 3
    const group = geometry.groups.find(
      (candidate) => triangleStart >= candidate.start && triangleStart < candidate.start + candidate.count,
    )

    if (!group || group.materialIndex === undefined) {
      return null
    }

    return materialIndexToFaceName(group.materialIndex)
  }

  private extractFaceNormalWorld(intersection: Intersection<Object3D>): Vector3 {
    const faceNormal = intersection.face?.normal.clone()
    if (!faceNormal) {
      return new Vector3(0, 0, 1)
    }

    return faceNormal.transformDirection(intersection.object.matrixWorld).normalize()
  }

  private extractCubeWorldQuaternionInverse(intersection: Intersection<Object3D>): Quaternion {
    const mesh = intersection.object as Mesh
    const parent = mesh.parent
    if (!parent) {
      return new Quaternion()
    }

    return parent.getWorldQuaternion(new Quaternion()).invert()
  }

  private extractFaceCoordinateFromIntersection(
    intersection: Intersection<Object3D>,
  ): { dimension: number; x: number; y: number; z: number } {
    const mesh = intersection.object as Mesh
    const allTargets = this.getTurnTargets()
    const xValues = getSortedUniqueAxisValues(allTargets, 'x')
    const yValues = getSortedUniqueAxisValues(allTargets, 'y')
    const zValues = getSortedUniqueAxisValues(allTargets, 'z')
    const dimension = Math.min(xValues.length, yValues.length, zValues.length)

    if (dimension <= 1) {
      return { dimension: 1, x: 0, y: 0, z: 0 }
    }

    const x = findNearestAxisIndex(xValues, mesh.position.x)
    const y = findNearestAxisIndex(yValues, mesh.position.y)
    const z = findNearestAxisIndex(zValues, mesh.position.z)
    return { dimension, x, y, z }
  }
}

export function inferDragTurnMove(
  face: FaceName,
  deltaX: number,
  deltaY: number,
): DragTurnMove {
  return {
    face,
    direction: inferTurnDirection(face, deltaX, deltaY),
    layer: 0,
  }
}

export function resolveDragIntent(
  face: FaceName,
  dimension: number,
  x: number,
  y: number,
  z: number,
  localDrag: Vector3,
  preferredDragAxis?: Axis,
): DragTurnResolution | null {
  const { axis: faceAxis, sign: faceSign } = getFaceAxisSign(face)
  const faceKey = toFaceKey(faceAxis, faceSign)
  const tangentAxes = getTangentAxes(faceAxis)
  const dragAxis =
    preferredDragAxis !== undefined && tangentAxes.includes(preferredDragAxis)
      ? preferredDragAxis
      : Math.abs(localDrag[tangentAxes[0]]) >= Math.abs(localDrag[tangentAxes[1]])
        ? tangentAxes[0]
        : tangentAxes[1]

  const dragComponent = localDrag[dragAxis]
  if (Math.abs(dragComponent) < 0.0001) {
    return null
  }

  const rotationAxis = getRemainingAxis(faceAxis, dragAxis)
  const rotationSignFactor = DRAG_ROTATION_SIGN[faceKey][dragAxis]
  if (rotationSignFactor === undefined) {
    return null
  }

  const dragSign: 1 | -1 = dragComponent >= 0 ? 1 : -1
  const rotationSign: 1 | -1 = (rotationSignFactor * dragSign) as 1 | -1

  const axisIndex = getAxisIndex(rotationAxis, x, y, z)
  let targetFaceAxis: Axis = rotationAxis
  let layerAxisIndex = axisIndex
  let sliceSign = axisIndexToSliceSign(axisIndex, dimension)
  if ((face === 'F' || face === 'B') && dragAxis === 'x' && rotationAxis === 'y') {
    sliceSign = (sliceSign * -1) as 1 | -1
    layerAxisIndex = getBandDepthLayer(axisIndex, dimension)
  }

  let directionOverride: TurnDirection | undefined
  if ((face === 'U' || face === 'D') && dragAxis === 'z') {
    const horizontal = resolveTopBottomFaceHorizontalDrag(dimension, x, z, dragSign)
    targetFaceAxis = horizontal.targetFaceAxis
    sliceSign = horizontal.sliceSign
    layerAxisIndex = horizontal.layerAxisIndex
    directionOverride = horizontal.directionOverride
  }

  const targetFace = axisSignToFace(targetFaceAxis, sliceSign)
  let direction = mapRotationSignToDirection(targetFace, rotationSign)
  if (directionOverride !== undefined) {
    direction = directionOverride
  }
  const layer = mapAxisIndexToLayer(targetFace, layerAxisIndex, dimension)

  return {
    move: {
      face: targetFace,
      direction,
      layer,
    },
    dragAxis,
    rotationAxis,
    rotationSign,
    faceKey,
  }
}

function resolveTopBottomFaceHorizontalDrag(
  dimension: number,
  x: number,
  z: number,
  dragSign: 1 | -1,
): {
  targetFaceAxis: Axis
  sliceSign: 1 | -1
  layerAxisIndex: number
  directionOverride?: TurnDirection
} {
  const maxIndex = Math.max(0, dimension - 1)

  if (dragSign > 0) {
    if (x === 0) {
      const useBackSlice = z === 0
      if (useBackSlice) {
        return {
          targetFaceAxis: 'x',
          sliceSign: -1,
          layerAxisIndex: x,
          directionOverride: 'CW',
        }
      }

      return {
        targetFaceAxis: 'z',
        sliceSign: 1,
        layerAxisIndex: z,
        directionOverride: 'CW',
      }
    }

    if (x === maxIndex) {
      return {
        targetFaceAxis: 'x',
        sliceSign: 1,
        layerAxisIndex: x,
      }
    }

    return {
      targetFaceAxis: z === 0 ? 'x' : 'z',
      sliceSign: z === 0 ? 1 : axisIndexToSliceSign(z, dimension),
      layerAxisIndex: z === 0 ? x : z === maxIndex ? getBandDepthLayer(x, dimension) : z,
      directionOverride: z === 0 ? undefined : 'CW',
    }
  }

  if (z === 0) {
    return {
      targetFaceAxis: 'x',
      sliceSign: axisIndexToSliceSign(x, dimension),
      layerAxisIndex: x,
    }
  }

  if (x === 0 && z === maxIndex) {
    return {
      targetFaceAxis: 'x',
      sliceSign: 1,
      layerAxisIndex: Math.floor((dimension - 1) / 2),
    }
  }

  const sliceSign = axisIndexToSliceSign(z, dimension)
  const directionOverride =
    x === maxIndex
      ? sliceSign > 0
        ? 'CCW'
        : 'CW'
      : undefined
  return {
    targetFaceAxis: 'z',
    sliceSign,
    layerAxisIndex: z,
    directionOverride,
  }
}

function resolveDragTurnMove(
  start: DragStart,
  camera: PerspectiveCamera,
  deltaX: number,
  deltaY: number,
  preferredScreenIntent: ScreenIntent | null,
): DragTurnResolution | null {
  const cameraRight = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  const cameraUp = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  const worldDrag = new Vector3()
    .addScaledVector(cameraRight, deltaX)
    .addScaledVector(cameraUp, -deltaY)

  const normalComponent = worldDrag.dot(start.faceNormalWorld)
  worldDrag.addScaledVector(start.faceNormalWorld, -normalComponent)

  if (worldDrag.lengthSq() < 0.0001) {
    return null
  }

  const localDrag = worldDrag.clone().applyQuaternion(start.cubeWorldQuaternionInverse)
  const screenIntent = preferredScreenIntent ?? classifyScreenIntent(deltaX, deltaY)
  const screenHorizontal =
    screenIntent !== null ? screenIntent === 'horizontal' : Math.abs(deltaX) >= Math.abs(deltaY)
  const maxIndex = Math.max(0, start.dimension - 1)
  const touchingTopOrBottomBand = start.y === 0 || start.y === maxIndex
  const startsOnTopOrBottomFace = start.face === 'U' || start.face === 'D'
  if (screenHorizontal && touchingTopOrBottomBand && !startsOnTopOrBottomFace) {
    return resolveTopBottomHorizontalTurn(start.dimension, start.x, start.y, deltaX)
  }

  const preferredDragAxis =
    (start.face === 'U' || start.face === 'D') && screenIntent !== null
      ? (screenIntent === 'horizontal' ? 'z' : 'x')
      : undefined

  const resolution = resolveDragIntent(start.face, start.dimension, start.x, start.y, start.z, localDrag, preferredDragAxis)
  if (!resolution) {
    return null
  }

  return resolution
}

export function resolveTopBottomHorizontalTurn(
  dimension: number,
  x: number,
  y: number,
  deltaX: number,
): DragTurnResolution {
  const targetFace: FaceName = y === Math.max(0, dimension - 1) ? 'U' : 'D'
  const movingRight = deltaX >= 0
  const direction: TurnDirection =
    targetFace === 'U'
      ? (movingRight ? 'CCW' : 'CW')
      : (movingRight ? 'CW' : 'CCW')
  const layer = getBandDepthLayer(x, dimension)
  const rotationSign = directionToRotationSign(targetFace, direction)
  const faceKey: FaceKey = y === Math.max(0, dimension - 1) ? 'y+' : 'y-'

  return {
    move: {
      face: targetFace,
      direction,
      layer,
    },
    dragAxis: 'z',
    rotationAxis: 'y',
    rotationSign,
    faceKey,
  }
}

function classifyScreenIntent(deltaX: number, deltaY: number): ScreenIntent | null {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (absX < DRAG_THRESHOLD_PX && absY < DRAG_THRESHOLD_PX) {
    return null
  }

  if (absX >= absY * INTENT_DOMINANCE_RATIO) {
    return 'horizontal'
  }

  if (absY >= absX * INTENT_DOMINANCE_RATIO) {
    return 'vertical'
  }

  return null
}

function getAxisValue(position: { x: number; y: number; z: number }, axis: Axis): number {
  if (axis === 'x') {
    return position.x
  }

  if (axis === 'y') {
    return position.y
  }

  return position.z
}

function getSortedUniqueAxisValues(meshes: Mesh[], axis: Axis): number[] {
  const sortedValues = meshes
    .map((mesh) => getAxisValue(mesh.position, axis))
    .sort((left, right) => left - right)

  const uniqueValues: number[] = []
  for (const value of sortedValues) {
    if (uniqueValues.length === 0 || Math.abs(value - uniqueValues[uniqueValues.length - 1]) > AXIS_TOLERANCE) {
      uniqueValues.push(value)
    }
  }

  return uniqueValues
}

function findNearestAxisIndex(axisValues: number[], axisValue: number): number {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  axisValues.forEach((value, index) => {
    const distance = Math.abs(value - axisValue)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return nearestIndex
}

function materialIndexToFaceName(materialIndex: number): FaceName | null {
  switch (materialIndex) {
    case 0:
      return 'R'
    case 1:
      return 'L'
    case 2:
      return 'U'
    case 3:
      return 'D'
    case 4:
      return 'F'
    case 5:
      return 'B'
    default:
      return null
  }
}

export function mapAxisIndexToLayer(face: FaceName, axisIndex: number, axisCount: number): number {
  const maxAxisIndex = Math.max(0, axisCount - 1)
  const clampedAxisIndex = Math.max(0, Math.min(axisIndex, maxAxisIndex))

  if (face === 'R' || face === 'U' || face === 'F') {
    return maxAxisIndex - clampedAxisIndex
  }

  return clampedAxisIndex
}

function getFaceAxisSign(face: FaceName): { axis: Axis; sign: 1 | -1 } {
  if (face === 'R') {
    return { axis: 'x', sign: 1 }
  }

  if (face === 'L') {
    return { axis: 'x', sign: -1 }
  }

  if (face === 'U') {
    return { axis: 'y', sign: 1 }
  }

  if (face === 'D') {
    return { axis: 'y', sign: -1 }
  }

  if (face === 'F') {
    return { axis: 'z', sign: 1 }
  }

  return { axis: 'z', sign: -1 }
}

function toFaceKey(axis: Axis, sign: 1 | -1): FaceKey {
  return `${axis}${sign > 0 ? '+' : '-'}` as FaceKey
}

function getTangentAxes(faceAxis: Axis): [Axis, Axis] {
  if (faceAxis === 'x') {
    return ['y', 'z']
  }

  if (faceAxis === 'y') {
    return ['x', 'z']
  }

  return ['x', 'y']
}

function getRemainingAxis(faceAxis: Axis, dragAxis: Axis): Axis {
  if ((faceAxis === 'x' && dragAxis === 'y') || (faceAxis === 'y' && dragAxis === 'x')) {
    return 'z'
  }

  if ((faceAxis === 'x' && dragAxis === 'z') || (faceAxis === 'z' && dragAxis === 'x')) {
    return 'y'
  }

  return 'x'
}

function getAxisIndex(axis: Axis, x: number, y: number, z: number): number {
  if (axis === 'x') {
    return x
  }

  if (axis === 'y') {
    return y
  }

  return z
}

function axisIndexToSliceSign(axisIndex: number, dimension: number): 1 | -1 {
  return axisIndex >= (dimension - 1) / 2 ? 1 : -1
}

function getBandDepthLayer(axisIndex: number, dimension: number): number {
  const maxIndex = Math.max(0, dimension - 1)
  const clamped = Math.max(0, Math.min(axisIndex, maxIndex))
  return Math.min(clamped, maxIndex - clamped)
}

function axisSignToFace(axis: Axis, sign: 1 | -1): FaceName {
  if (axis === 'x') {
    return sign > 0 ? 'R' : 'L'
  }

  if (axis === 'y') {
    return sign > 0 ? 'U' : 'D'
  }

  return sign > 0 ? 'F' : 'B'
}

function mapRotationSignToDirection(face: FaceName, rotationSign: 1 | -1): TurnDirection {
  const faceSign = face === 'R' || face === 'U' || face === 'F' ? 1 : -1
  return rotationSign === faceSign ? 'CCW' : 'CW'
}

function directionToRotationSign(face: FaceName, direction: TurnDirection): 1 | -1 {
  const faceSign: 1 | -1 = face === 'R' || face === 'U' || face === 'F' ? 1 : -1
  return direction === 'CCW' ? faceSign : ((-faceSign) as 1 | -1)
}

function inferTurnDirection(face: FaceName, deltaX: number, deltaY: number): TurnDirection {
  const horizontal = Math.abs(deltaX) >= Math.abs(deltaY)
  let direction: TurnDirection

  if (horizontal) {
    const right = deltaX > 0
    switch (face) {
      case 'F':
      case 'U':
      case 'R':
        direction = right ? 'CW' : 'CCW'
        break
      case 'B':
      case 'D':
      case 'L':
        direction = right ? 'CCW' : 'CW'
        break
      default:
        direction = 'CW'
        break
    }
  } else {
    const down = deltaY > 0
    switch (face) {
      case 'F':
      case 'D':
      case 'L':
        direction = down ? 'CCW' : 'CW'
        break
      case 'B':
      case 'U':
      case 'R':
        direction = down ? 'CW' : 'CCW'
        break
      default:
        direction = 'CW'
        break
    }
  }

  return direction === 'CW' ? 'CCW' : 'CW'
}
