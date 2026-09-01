import {
  BufferGeometry,
  MOUSE,
  Matrix4,
  Raycaster,
  Vector2,
  Vector3,
  type Intersection,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CubeMove, FaceName, TurnDirection } from '../domain/cubeNotation'
import {
  projectFaceTangents,
  resolveDragTurnIntent,
  type Axis,
  type AxisSign,
  type DragTurnIntentResolution,
  type ProjectedTangent,
} from './dragTurnIntentResolver'

interface DragStart {
  pointerId: number
  clientX: number
  clientY: number
  face: FaceName
  dimension: number
  x: number
  y: number
  z: number
  faceNormalLocal: Vector3
  tangents: [ProjectedTangent, ProjectedTangent]
  lockedResolution: DragTurnIntentResolution | null
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
  tangentAxis?: Axis
  rotationAxis?: Axis
  rotationSign?: AxisSign
  thresholdPx?: number
}

const DRAG_THRESHOLD_PX = 10
const INTENT_CONFIDENCE_RATIO = 1.2
const AXIS_TOLERANCE = 0.001

type Coordinate = Pick<DragStart, 'dimension' | 'x' | 'y' | 'z'>

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
    this.controls.rotateSpeed = 1.65
    this.controls.minPolarAngle = 0.15
    this.controls.maxPolarAngle = Math.PI - 0.15
    this.controls.mouseButtons.LEFT = null
    this.controls.mouseButtons.RIGHT = null
    this.controls.mouseButtons.MIDDLE = MOUSE.ROTATE
    this.controls.addEventListener('change', () => this.requestRender())

    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel)
  }

  public dispose(): void {
    this.controls.dispose()
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel)
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return
    }

    if (!this.canStartTurn()) {
      this.clearDrag()
      this.onDebug?.({ phase: 'blocked' })
      return
    }

    const intersection = this.getIntersection(event.clientX, event.clientY)
    if (!intersection) {
      this.clearDrag()
      this.onDebug?.({ phase: 'cancel' })
      return
    }

    const mesh = intersection.object as Mesh
    const face = this.extractFaceFromIntersection(intersection)
    const faceNormalLocal = faceNameToNormal(face)
    const rect = this.canvas.getBoundingClientRect()
    mesh.parent?.updateWorldMatrix(true, false)
    this.camera.updateMatrixWorld()
    const tangents = projectFaceTangents(
      faceNormalLocal,
      intersection.point,
      mesh.parent?.matrixWorld ?? new Matrix4(),
      this.camera,
      { width: rect.width, height: rect.height },
    )

    if (!tangents) {
      this.clearDrag()
      this.onDebug?.({ phase: 'cancel' })
      return
    }

    const coordinate = this.extractFaceCoordinateFromIntersection(intersection)
    this.dragStart = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      face,
      ...coordinate,
      faceNormalLocal,
      tangents,
      lockedResolution: null,
    }
    this.canvas.setPointerCapture(event.pointerId)
    this.onDebug?.({
      phase: 'down',
      face,
      x: coordinate.x,
      y: coordinate.y,
      z: coordinate.z,
      thresholdPx: DRAG_THRESHOLD_PX,
    })
  }

  private handlePointerMove = (event: PointerEvent): void => {
    const start = this.dragStart
    if (!start || event.pointerId !== start.pointerId) {
      return
    }

    const deltaX = event.clientX - start.clientX
    const deltaY = event.clientY - start.clientY
    const resolution = this.resolveIntent(start, deltaX, deltaY)
    if (!start.lockedResolution && resolution) {
      start.lockedResolution = resolution
    }

    this.reportGesture('drag', start, deltaX, deltaY, start.lockedResolution)
  }

  private handlePointerUp = (event: PointerEvent): void => {
    const start = this.dragStart
    if (!start || event.pointerId !== start.pointerId || event.button !== 0) {
      return
    }

    const deltaX = event.clientX - start.clientX
    const deltaY = event.clientY - start.clientY
    const resolution = start.lockedResolution ?? this.resolveIntent(start, deltaX, deltaY)
    this.clearDrag()

    if (!resolution) {
      this.reportGesture('ignored', start, deltaX, deltaY, null)
      return
    }

    this.reportGesture('up', start, deltaX, deltaY, resolution)
    this.onFaceTurn(resolution.move)
  }

  private handlePointerCancel = (event: PointerEvent): void => {
    if (this.dragStart && event.pointerId !== this.dragStart.pointerId) {
      return
    }

    this.clearDrag()
    this.onDebug?.({ phase: 'cancel' })
  }

  private resolveIntent(start: DragStart, deltaX: number, deltaY: number): DragTurnIntentResolution | null {
    return resolveDragTurnIntent({
      dimension: start.dimension,
      coordinate: { x: start.x, y: start.y, z: start.z },
      faceNormalLocal: start.faceNormalLocal,
      tangents: start.tangents,
      pointerDelta: new Vector2(deltaX, deltaY),
      thresholdPx: DRAG_THRESHOLD_PX,
      confidenceRatio: INTENT_CONFIDENCE_RATIO,
    })
  }

  private reportGesture(
    phase: 'drag' | 'up' | 'ignored',
    start: DragStart,
    deltaX: number,
    deltaY: number,
    resolution: DragTurnIntentResolution | null,
  ): void {
    this.onDebug?.({
      phase,
      face: resolution?.move.face ?? start.face,
      layer: resolution?.move.layer,
      x: start.x,
      y: start.y,
      z: start.z,
      deltaX,
      deltaY,
      direction: resolution?.move.direction,
      tangentAxis: resolution?.tangentAxis,
      rotationAxis: resolution?.rotationAxis,
      rotationSign: resolution?.rotationSign,
      thresholdPx: DRAG_THRESHOLD_PX,
    })
  }

  private clearDrag(): void {
    if (this.dragStart && this.canvas.hasPointerCapture(this.dragStart.pointerId)) {
      this.canvas.releasePointerCapture(this.dragStart.pointerId)
    }
    this.dragStart = null
  }

  private getIntersection(clientX: number, clientY: number): Intersection<Object3D> | null {
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.pointer.set(x, y)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.raycaster.intersectObjects(this.getTurnTargets(), false)[0] ?? null
  }

  private extractFaceFromIntersection(intersection: Intersection<Object3D>): FaceName {
    const materialFace = this.extractFaceFromMaterialIndex(intersection)
    return materialFace ?? faceNormalToName(intersection.face?.normal ?? new Vector3(0, 0, 1))
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
    return group?.materialIndex === undefined ? null : materialIndexToFaceName(group.materialIndex)
  }

  private extractFaceCoordinateFromIntersection(intersection: Intersection<Object3D>): Coordinate {
    const mesh = intersection.object as Mesh
    const allTargets = this.getTurnTargets()
    const xValues = getSortedUniqueAxisValues(allTargets, 'x')
    const yValues = getSortedUniqueAxisValues(allTargets, 'y')
    const zValues = getSortedUniqueAxisValues(allTargets, 'z')
    const dimension = Math.min(xValues.length, yValues.length, zValues.length)

    if (dimension <= 1) {
      return { dimension: 1, x: 0, y: 0, z: 0 }
    }

    return {
      dimension,
      x: findNearestAxisIndex(xValues, mesh.position.x),
      y: findNearestAxisIndex(yValues, mesh.position.y),
      z: findNearestAxisIndex(zValues, mesh.position.z),
    }
  }
}

function getSortedUniqueAxisValues(meshes: Mesh[], axis: Axis): number[] {
  const sortedValues = meshes.map((mesh) => mesh.position[axis]).sort((left, right) => left - right)
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

function faceNormalToName(normal: Vector3): FaceName {
  if (Math.abs(normal.x) >= Math.abs(normal.y) && Math.abs(normal.x) >= Math.abs(normal.z)) {
    return normal.x >= 0 ? 'R' : 'L'
  }
  if (Math.abs(normal.y) >= Math.abs(normal.z)) {
    return normal.y >= 0 ? 'U' : 'D'
  }
  return normal.z >= 0 ? 'F' : 'B'
}

function faceNameToNormal(face: FaceName): Vector3 {
  switch (face) {
    case 'R': return new Vector3(1, 0, 0)
    case 'L': return new Vector3(-1, 0, 0)
    case 'U': return new Vector3(0, 1, 0)
    case 'D': return new Vector3(0, -1, 0)
    case 'F': return new Vector3(0, 0, 1)
    case 'B': return new Vector3(0, 0, -1)
  }
}

function materialIndexToFaceName(materialIndex: number): FaceName | null {
  return (['R', 'L', 'U', 'D', 'F', 'B'] as const)[materialIndex] ?? null
}