export const FACE_NAMES = ['U', 'D', 'L', 'R', 'F', 'B'] as const

export type FaceName = (typeof FACE_NAMES)[number]

export type TurnDirection = 'CW' | 'CCW'

export interface CubeMove {
  face: FaceName
  layer: number
  direction: TurnDirection
  turns: 1 | 2
}

export function createMove(
  face: FaceName,
  layer: number,
  direction: TurnDirection,
  turns: 1 | 2 = 1,
): CubeMove {
  if (layer < 0) {
    throw new Error('Layer index must be zero or greater.')
  }

  return { face, layer, direction, turns }
}

export function invertMove(move: CubeMove): CubeMove {
  if (move.turns === 2) {
    return move
  }

  return {
    ...move,
    direction: move.direction === 'CW' ? 'CCW' : 'CW',
  }
}

export function moveToNotation(move: CubeMove): string {
  const layerPrefix = move.layer > 0 ? `${move.layer + 1}` : ''
  const directionSuffix = move.turns === 2 ? '2' : move.direction === 'CCW' ? "'" : ''
  return `${layerPrefix}${move.face}${directionSuffix}`
}
