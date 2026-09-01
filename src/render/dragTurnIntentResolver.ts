import {
  Matrix4,
  Vector2,
  Vector3,
  type PerspectiveCamera,
} from 'three'
import { createMove, type CubeMove, type FaceName, type TurnDirection } from '../domain/cubeNotation'

export type Axis = 'x' | 'y' | 'z'
export type AxisSign = 1 | -1

export interface CubieCoordinate {
  x: number
  y: number
  z: number
}

export interface ProjectedTangent {
  axis: Axis
  localDirection: Vector3
  screenDirection: Vector2
}

export interface DragTurnIntentInput {
  dimension: number
  coordinate: CubieCoordinate
  faceNormalLocal: Vector3
  tangents: readonly [ProjectedTangent, ProjectedTangent]
  pointerDelta: Vector2
  thresholdPx: number
  confidenceRatio: number
}

export interface DragTurnIntentResolution {
  move: CubeMove
  tangentAxis: Axis
  rotationAxis: Axis
  rotationSign: AxisSign
  axisIndex: number
}

interface ViewportSize {
  width: number
  height: number
}

const POSITIVE_AXIS_FACES: Record<Axis, FaceName> = {
  x: 'R',
  y: 'U',
  z: 'F',
}

const NEGATIVE_AXIS_FACES: Record<Axis, FaceName> = {
  x: 'L',
  y: 'D',
  z: 'B',
}

export function projectFaceTangents(
  faceNormalLocal: Vector3,
  hitPointWorld: Vector3,
  cubeMatrixWorld: Matrix4,
  camera: PerspectiveCamera,
  viewport: ViewportSize,
): [ProjectedTangent, ProjectedTangent] | null {
  const normalAxis = getCardinalAxis(faceNormalLocal)
  if (!normalAxis || viewport.width <= 0 || viewport.height <= 0) {
    return null
  }

  const tangentAxes = getTangentAxes(normalAxis.axis)
  const projected = tangentAxes.map((axis) => {
    const localDirection = axisVector(axis)
    const worldDirection = localDirection.clone().transformDirection(cubeMatrixWorld)
    const screenDirection = projectWorldDirection(
      hitPointWorld,
      worldDirection,
      camera,
      viewport,
    )

    if (!screenDirection) {
      return null
    }

    return { axis, localDirection, screenDirection }
  })

  if (!projected[0] || !projected[1]) {
    return null
  }

  return [projected[0], projected[1]]
}

export function resolveDragTurnIntent(
  input: DragTurnIntentInput,
): DragTurnIntentResolution | null {
  if (input.dimension < 2 || input.pointerDelta.length() < input.thresholdPx) {
    return null
  }

  const pointerDirection = input.pointerDelta.clone().normalize()
  const scoredTangents = input.tangents.map((tangent) => ({
    tangent,
    signedScore: pointerDirection.dot(tangent.screenDirection),
  }))
  scoredTangents.sort((left, right) => Math.abs(right.signedScore) - Math.abs(left.signedScore))

  const winner = scoredTangents[0]
  const runnerUp = scoredTangents[1]
  if (
    Math.abs(winner.signedScore) < Math.abs(runnerUp.signedScore) * input.confidenceRatio
  ) {
    return null
  }

  const tangentSign: AxisSign = winner.signedScore >= 0 ? 1 : -1
  const signedTangent = winner.tangent.localDirection.clone().multiplyScalar(tangentSign)
  const rotationVector = input.faceNormalLocal.clone().cross(signedTangent)
  const rotation = getCardinalAxis(rotationVector)
  if (!rotation) {
    return null
  }

  const axisIndex = input.coordinate[rotation.axis]
  if (!Number.isInteger(axisIndex) || axisIndex < 0 || axisIndex >= input.dimension) {
    return null
  }

  return {
    move: physicalTurnToMove(rotation.axis, rotation.sign, axisIndex, input.dimension),
    tangentAxis: winner.tangent.axis,
    rotationAxis: rotation.axis,
    rotationSign: rotation.sign,
    axisIndex,
  }
}

export function physicalTurnToMove(
  axis: Axis,
  rotationSign: AxisSign,
  axisIndex: number,
  dimension: number,
): CubeMove {
  const maxIndex = dimension - 1
  const usePositiveFace = axisIndex >= dimension / 2
  const face = usePositiveFace ? POSITIVE_AXIS_FACES[axis] : NEGATIVE_AXIS_FACES[axis]
  const layer = usePositiveFace ? maxIndex - axisIndex : axisIndex
  const direction = rotationSignToDirection(usePositiveFace, rotationSign)
  return createMove(face, layer, direction)
}

function projectWorldDirection(
  originWorld: Vector3,
  directionWorld: Vector3,
  camera: PerspectiveCamera,
  viewport: ViewportSize,
): Vector2 | null {
  const originNdc = originWorld.clone().project(camera)
  const endpointNdc = originWorld.clone().add(directionWorld).project(camera)
  const screenDirection = new Vector2(
    (endpointNdc.x - originNdc.x) * viewport.width / 2,
    -(endpointNdc.y - originNdc.y) * viewport.height / 2,
  )

  if (screenDirection.lengthSq() < 0.000001) {
    return null
  }

  return screenDirection.normalize()
}

function getCardinalAxis(vector: Vector3): { axis: Axis; sign: AxisSign } | null {
  const components: Array<{ axis: Axis; value: number }> = [
    { axis: 'x', value: vector.x },
    { axis: 'y', value: vector.y },
    { axis: 'z', value: vector.z },
  ]
  components.sort((left, right) => Math.abs(right.value) - Math.abs(left.value))

  if (Math.abs(components[0].value) < 0.5) {
    return null
  }

  return {
    axis: components[0].axis,
    sign: components[0].value >= 0 ? 1 : -1,
  }
}

function getTangentAxes(normalAxis: Axis): [Axis, Axis] {
  if (normalAxis === 'x') {
    return ['y', 'z']
  }

  if (normalAxis === 'y') {
    return ['x', 'z']
  }

  return ['x', 'y']
}

function axisVector(axis: Axis): Vector3 {
  if (axis === 'x') {
    return new Vector3(1, 0, 0)
  }

  if (axis === 'y') {
    return new Vector3(0, 1, 0)
  }

  return new Vector3(0, 0, 1)
}

function rotationSignToDirection(
  positiveFace: boolean,
  rotationSign: AxisSign,
): TurnDirection {
  if (positiveFace) {
    return rotationSign > 0 ? 'CCW' : 'CW'
  }

  return rotationSign > 0 ? 'CW' : 'CCW'
}