import type { FaceName } from './cubeNotation'

export type StickerColor = 'W' | 'Y' | 'O' | 'R' | 'G' | 'B'

export type FaceGrid = StickerColor[][]

export interface CubeState {
  dimension: number
  faces: Record<FaceName, FaceGrid>
}

const SOLVED_FACE_COLORS: Record<FaceName, StickerColor> = {
  U: 'W',
  D: 'Y',
  L: 'O',
  R: 'G',
  F: 'R',
  B: 'B',
}

export function createSolvedCubeState(dimension: number): CubeState {
  if (!Number.isInteger(dimension) || dimension < 2) {
    throw new Error('Cube dimension must be an integer greater than or equal to 2.')
  }

  return {
    dimension,
    faces: {
      U: createFace(dimension, SOLVED_FACE_COLORS.U),
      D: createFace(dimension, SOLVED_FACE_COLORS.D),
      L: createFace(dimension, SOLVED_FACE_COLORS.L),
      R: createFace(dimension, SOLVED_FACE_COLORS.R),
      F: createFace(dimension, SOLVED_FACE_COLORS.F),
      B: createFace(dimension, SOLVED_FACE_COLORS.B),
    },
  }
}

function createFace(dimension: number, color: StickerColor): FaceGrid {
  return Array.from({ length: dimension }, () => Array.from({ length: dimension }, () => color))
}
