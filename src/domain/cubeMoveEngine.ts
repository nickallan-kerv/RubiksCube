import type { CubeMove, FaceName } from './cubeNotation'
import type { CubeState, FaceGrid, StickerColor } from './cubeState'

type Axis = 'x' | 'y' | 'z'

interface Sticker {
  x: number
  y: number
  z: number
  nx: number
  ny: number
  nz: number
  color: StickerColor
}

const FACE_NORMALS: Record<FaceName, [number, number, number]> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
}

const POSITIVE_FACES: FaceName[] = ['R', 'U', 'F']

export function applyMove(state: CubeState, move: CubeMove): CubeState {
  validateLayer(state.dimension, move.layer)

  let stickers = extractStickers(state)
  const quarterTurns = move.turns === 2 ? 2 : 1

  for (let i = 0; i < quarterTurns; i += 1) {
    stickers = rotateMoveQuarterTurn(stickers, state.dimension, move)
  }

  return {
    dimension: state.dimension,
    faces: buildFacesFromStickers(state.dimension, stickers),
  }
}

export function applyMoves(state: CubeState, moves: CubeMove[]): CubeState {
  return moves.reduce((currentState, move) => applyMove(currentState, move), state)
}

function validateLayer(dimension: number, layer: number): void {
  if (!Number.isInteger(layer) || layer < 0 || layer >= dimension) {
    throw new Error(`Layer index must be between 0 and ${dimension - 1}.`)
  }
}

function rotateMoveQuarterTurn(stickers: Sticker[], dimension: number, move: CubeMove): Sticker[] {
  const axis = getAxis(move.face)
  const layerCoordinate = getLayerCoordinate(dimension, move.face, move.layer)
  const quarterRotation = getQuarterRotationSign(move)

  return stickers.map((sticker) => {
    if (!isStickerOnLayer(sticker, axis, layerCoordinate)) {
      return sticker
    }

    const rotatedPosition = rotatePosition(sticker, dimension, axis, quarterRotation)
    const rotatedNormal = rotateNormal(sticker, axis, quarterRotation)

    return {
      ...sticker,
      ...rotatedPosition,
      ...rotatedNormal,
    }
  })
}

function getAxis(face: FaceName): Axis {
  if (face === 'L' || face === 'R') {
    return 'x'
  }

  if (face === 'U' || face === 'D') {
    return 'y'
  }

  return 'z'
}

function getLayerCoordinate(dimension: number, face: FaceName, layer: number): number {
  const positiveFacing = POSITIVE_FACES.includes(face)
  return positiveFacing ? dimension - 1 - layer : layer
}

function getQuarterRotationSign(move: CubeMove): 1 | -1 {
  const faceSign = POSITIVE_FACES.includes(move.face) ? 1 : -1
  return move.direction === 'CW' ? (faceSign === 1 ? -1 : 1) : faceSign
}

function isStickerOnLayer(sticker: Sticker, axis: Axis, layerCoordinate: number): boolean {
  if (axis === 'x') {
    return sticker.x === layerCoordinate
  }

  if (axis === 'y') {
    return sticker.y === layerCoordinate
  }

  return sticker.z === layerCoordinate
}

function rotatePosition(
  sticker: Sticker,
  dimension: number,
  axis: Axis,
  quarterRotation: 1 | -1,
): Pick<Sticker, 'x' | 'y' | 'z'> {
  const max = dimension - 1
  const { x, y, z } = sticker

  if (axis === 'x') {
    if (quarterRotation === 1) {
      return { x, y: z, z: max - y }
    }

    return { x, y: max - z, z: y }
  }

  if (axis === 'y') {
    if (quarterRotation === 1) {
      return { x: max - z, y, z: x }
    }

    return { x: z, y, z: max - x }
  }

  if (quarterRotation === 1) {
    return { x: y, y: max - x, z }
  }

  return { x: max - y, y: x, z }
}

function rotateNormal(sticker: Sticker, axis: Axis, quarterRotation: 1 | -1): Pick<Sticker, 'nx' | 'ny' | 'nz'> {
  const { nx, ny, nz } = sticker

  if (axis === 'x') {
    if (quarterRotation === 1) {
      return { nx, ny: -nz, nz: ny }
    }

    return { nx, ny: nz, nz: -ny }
  }

  if (axis === 'y') {
    if (quarterRotation === 1) {
      return { nx: nz, ny, nz: -nx }
    }

    return { nx: -nz, ny, nz: nx }
  }

  if (quarterRotation === 1) {
    return { nx: -ny, ny: nx, nz }
  }

  return { nx: ny, ny: -nx, nz }
}

function extractStickers(state: CubeState): Sticker[] {
  const stickers: Sticker[] = []

  for (const [face, grid] of Object.entries(state.faces) as [FaceName, FaceGrid][]) {
    const normal = FACE_NORMALS[face]

    for (let row = 0; row < state.dimension; row += 1) {
      for (let column = 0; column < state.dimension; column += 1) {
        const position = mapFaceCoordinatesToPosition(state.dimension, face, row, column)
        stickers.push({
          ...position,
          nx: normal[0],
          ny: normal[1],
          nz: normal[2],
          color: grid[row][column],
        })
      }
    }
  }

  return stickers
}

function buildFacesFromStickers(dimension: number, stickers: Sticker[]): Record<FaceName, FaceGrid> {
  const faces: Record<FaceName, FaceGrid> = {
    U: createBlankFace(dimension),
    D: createBlankFace(dimension),
    L: createBlankFace(dimension),
    R: createBlankFace(dimension),
    F: createBlankFace(dimension),
    B: createBlankFace(dimension),
  }

  for (const sticker of stickers) {
    const face = mapNormalToFace(sticker)
    const [row, column] = mapPositionToFaceCoordinates(dimension, face, sticker)
    faces[face][row][column] = sticker.color
  }

  return faces
}

function createBlankFace(dimension: number): FaceGrid {
  return Array.from({ length: dimension }, () => Array.from({ length: dimension }, () => 'W' as StickerColor))
}

function mapNormalToFace(sticker: Pick<Sticker, 'nx' | 'ny' | 'nz'>): FaceName {
  if (sticker.nx === 1) {
    return 'R'
  }

  if (sticker.nx === -1) {
    return 'L'
  }

  if (sticker.ny === 1) {
    return 'U'
  }

  if (sticker.ny === -1) {
    return 'D'
  }

  if (sticker.nz === 1) {
    return 'F'
  }

  return 'B'
}

function mapFaceCoordinatesToPosition(
  dimension: number,
  face: FaceName,
  row: number,
  column: number,
): Pick<Sticker, 'x' | 'y' | 'z'> {
  const max = dimension - 1

  if (face === 'F') {
    return { x: column, y: max - row, z: max }
  }

  if (face === 'B') {
    return { x: max - column, y: max - row, z: 0 }
  }

  if (face === 'U') {
    return { x: column, y: max, z: row }
  }

  if (face === 'D') {
    return { x: column, y: 0, z: max - row }
  }

  if (face === 'R') {
    return { x: max, y: max - row, z: max - column }
  }

  return { x: 0, y: max - row, z: column }
}

function mapPositionToFaceCoordinates(
  dimension: number,
  face: FaceName,
  sticker: Pick<Sticker, 'x' | 'y' | 'z'>,
): [number, number] {
  const max = dimension - 1

  if (face === 'F') {
    return [max - sticker.y, sticker.x]
  }

  if (face === 'B') {
    return [max - sticker.y, max - sticker.x]
  }

  if (face === 'U') {
    return [sticker.z, sticker.x]
  }

  if (face === 'D') {
    return [max - sticker.z, sticker.x]
  }

  if (face === 'R') {
    return [max - sticker.y, max - sticker.z]
  }

  return [max - sticker.y, sticker.z]
}
