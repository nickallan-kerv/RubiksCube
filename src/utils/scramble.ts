import { FACE_NAMES, createMove, type CubeMove, type FaceName } from '../domain/cubeNotation'

export function generateScrambleMoves(dimension: number, length: number): CubeMove[] {
  const sequence: CubeMove[] = []
  let previousFace: FaceName | null = null

  for (let i = 0; i < length; i += 1) {
    let face = randomFace(previousFace)
    const turns: 1 | 2 = Math.random() < 0.2 ? 2 : 1
    const direction = Math.random() < 0.5 ? 'CW' : 'CCW'
    const maxLayer = dimension > 3 ? 1 : 0
    const layer = maxLayer > 0 ? Math.floor(Math.random() * (maxLayer + 1)) : 0

    sequence.push(createMove(face, layer, direction, turns))
    previousFace = face
  }

  return sequence
}

function randomFace(previousFace: FaceName | null): FaceName {
  const candidates = FACE_NAMES.filter((face) => face !== previousFace)
  const index = Math.floor(Math.random() * candidates.length)
  return candidates[index]
}
