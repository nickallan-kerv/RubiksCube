import { CircleGeometry, Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Material } from 'three'
import type { FaceName } from '../domain/cubeNotation'
import type { CubeState, StickerColor } from '../domain/cubeState'
import { setCubieCoordinate } from './cubeTurnAnimation'
import { createSelectiveBevelBoxGeometry } from './selectiveBevelBoxGeometry'

const FACE_ORDER: FaceName[] = ['R', 'L', 'U', 'D', 'F', 'B']

const STICKER_COLORS: Record<StickerColor, string> = {
  W: '#f8f8f5',
  Y: '#f5c339',
  O: '#ef8e1a',
  R: '#d94a3a',
  G: '#3ea65a',
  B: '#2f68c8',
}

const CUBIE_BODY_SIZE = 0.95
const STICKER_OFFSET = CUBIE_BODY_SIZE / 2 + 0.006
const STICKER_GEOMETRY = new CircleGeometry(0.405, 32)
const BODY_GEOMETRY_CACHE = new Map<string, ReturnType<typeof createSelectiveBevelBoxGeometry>>()
const BODY_MATERIAL = new MeshStandardMaterial({
  color: new Color('#111315'),
  roughness: 0.72,
  metalness: 0.04,
})
const BODY_FACE_MATERIALS = FACE_ORDER.map(() => BODY_MATERIAL) as Material[]

const STICKER_MATERIALS = Object.fromEntries(
  Object.entries(STICKER_COLORS).map(([color, value]) => [
    color,
    new MeshPhysicalMaterial({
      color: new Color(value),
      roughness: 0.7,
      metalness: 0.03,
      clearcoat: 0.72,
      clearcoatRoughness: 0.12,
    }),
  ]),
) as Record<StickerColor, MeshPhysicalMaterial>

export function createCubeGroupFromState(state: CubeState): Group {
  const group = new Group()
  const spacing = 1
  const offset = (state.dimension - 1) / 2

  for (let x = 0; x < state.dimension; x += 1) {
    for (let y = 0; y < state.dimension; y += 1) {
      for (let z = 0; z < state.dimension; z += 1) {
        if (!isSurfaceCubie(state.dimension, x, y, z)) {
          continue
        }

        const cubie = new Mesh(getCubieBodyGeometry(state.dimension, x, y, z), BODY_FACE_MATERIALS)
        cubie.position.set((x - offset) * spacing, (y - offset) * spacing, (z - offset) * spacing)
        setCubieCoordinate(cubie, { x, y, z })

        for (const face of FACE_ORDER) {
          const stickerColor = getStickerColor(state, face, x, y, z)
          if (stickerColor) {
            cubie.add(createSticker(face, stickerColor))
          }
        }

        group.add(cubie)
      }
    }
  }

  group.rotation.x = Math.PI / 2

  return group
}

function getCubieBodyGeometry(dimension: number, x: number, y: number, z: number) {
  const exposedFaces = getExposedFaces(dimension, x, y, z)
  const cacheKey = FACE_ORDER.filter((face) => exposedFaces.has(face)).join('')
  let geometry = BODY_GEOMETRY_CACHE.get(cacheKey)
  if (!geometry) {
    geometry = createSelectiveBevelBoxGeometry(CUBIE_BODY_SIZE, 4, 0.085, exposedFaces)
    BODY_GEOMETRY_CACHE.set(cacheKey, geometry)
  }
  return geometry
}

function getExposedFaces(dimension: number, x: number, y: number, z: number): Set<FaceName> {
  const max = dimension - 1
  const faces = new Set<FaceName>()
  if (x === max) faces.add('R')
  if (x === 0) faces.add('L')
  if (y === max) faces.add('U')
  if (y === 0) faces.add('D')
  if (z === max) faces.add('F')
  if (z === 0) faces.add('B')
  return faces
}

function createSticker(face: FaceName, color: StickerColor): Mesh {
  const sticker = new Mesh(STICKER_GEOMETRY, STICKER_MATERIALS[color])
  sticker.userData.stickerFace = face

  if (face === 'R' || face === 'L') {
    sticker.position.x = face === 'R' ? STICKER_OFFSET : -STICKER_OFFSET
    sticker.rotation.y = face === 'R' ? Math.PI / 2 : -Math.PI / 2
  } else if (face === 'U' || face === 'D') {
    sticker.position.y = face === 'U' ? STICKER_OFFSET : -STICKER_OFFSET
    sticker.rotation.x = face === 'U' ? -Math.PI / 2 : Math.PI / 2
  } else {
    sticker.position.z = face === 'F' ? STICKER_OFFSET : -STICKER_OFFSET
    sticker.rotation.y = face === 'F' ? 0 : Math.PI
  }

  return sticker
}

function isSurfaceCubie(dimension: number, x: number, y: number, z: number): boolean {
  const max = dimension - 1
  return x === 0 || x === max || y === 0 || y === max || z === 0 || z === max
}

function getStickerColor(
  state: CubeState,
  face: FaceName,
  x: number,
  y: number,
  z: number,
): StickerColor | null {
  const max = state.dimension - 1

  if (face === 'F' && z === max) {
    return state.faces.F[max - y][x]
  }

  if (face === 'B' && z === 0) {
    return state.faces.B[max - y][max - x]
  }

  if (face === 'U' && y === max) {
    return state.faces.U[z][x]
  }

  if (face === 'D' && y === 0) {
    return state.faces.D[max - z][x]
  }

  if (face === 'R' && x === max) {
    return state.faces.R[max - y][max - z]
  }

  if (face === 'L' && x === 0) {
    return state.faces.L[max - y][z]
  }

  return null
}
