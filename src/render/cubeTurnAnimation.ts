import type { Object3D } from 'three'
import type { CubeMove, FaceName } from '../domain/cubeNotation'

export type TurnAxis = 'x' | 'y' | 'z'

export interface CubieCoordinate {
  x: number
  y: number
  z: number
}

export interface PhysicalCubeTurn {
  axis: TurnAxis
  coordinate: number
  angleRadians: number
}

const POSITIVE_FACES = new Set<FaceName>(['R', 'U', 'F'])

export function moveToPhysicalTurn(move: CubeMove, dimension: number): PhysicalCubeTurn {
  const positiveFace = POSITIVE_FACES.has(move.face)
  const clockwiseSign = positiveFace ? -1 : 1
  const directionSign = move.direction === 'CW' ? clockwiseSign : -clockwiseSign

  return {
    axis: faceToAxis(move.face),
    coordinate: positiveFace ? dimension - 1 - move.layer : move.layer,
    angleRadians: directionSign * move.turns * Math.PI / 2,
  }
}

export function isCubieInTurnLayer(cubie: Object3D, turn: PhysicalCubeTurn): boolean {
  const coordinate = getCubieCoordinate(cubie)
  return coordinate !== null && coordinate[turn.axis] === turn.coordinate
}

export function setCubieCoordinate(cubie: Object3D, coordinate: CubieCoordinate): void {
  cubie.userData.cubieCoordinate = { ...coordinate }
}

export function getCubieCoordinate(cubie: Object3D): CubieCoordinate | null {
  const value = cubie.userData.cubieCoordinate as Partial<CubieCoordinate> | undefined
  if (!value || !Number.isInteger(value.x) || !Number.isInteger(value.y) || !Number.isInteger(value.z)) {
    return null
  }

  return { x: value.x!, y: value.y!, z: value.z! }
}

export function easeInOutCubic(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress))
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2
}

function faceToAxis(face: FaceName): TurnAxis {
  if (face === 'L' || face === 'R') {
    return 'x'
  }

  if (face === 'U' || face === 'D') {
    return 'y'
  }

  return 'z'
}