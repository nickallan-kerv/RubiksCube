import type { CubeState, FaceGrid } from './cubeState'

export function isSolvedCubeState(state: CubeState): boolean {
  return Object.values(state.faces).every((faceGrid) => isSingleColorFace(faceGrid))
}

function isSingleColorFace(faceGrid: FaceGrid): boolean {
  const expected = faceGrid[0][0]
  return faceGrid.every((row) => row.every((cell) => cell === expected))
}
