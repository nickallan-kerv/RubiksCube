import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, type Material } from 'three'
import type { FaceName } from '../domain/cubeNotation'
import type { CubeState, StickerColor } from '../domain/cubeState'

const FACE_ORDER: FaceName[] = ['R', 'L', 'U', 'D', 'F', 'B']

const STICKER_COLORS: Record<StickerColor, string> = {
  W: '#f8f8f5',
  Y: '#f5c339',
  O: '#ef8e1a',
  R: '#d94a3a',
  G: '#3ea65a',
  B: '#2f68c8',
}

const INTERNAL_COLOR = '#1f2327'

export function createCubeGroupFromState(state: CubeState): Group {
  const group = new Group()
  const spacing = 1.02
  const offset = (state.dimension - 1) / 2
  const geometry = new BoxGeometry(0.95, 0.95, 0.95)

  for (let x = 0; x < state.dimension; x += 1) {
    for (let y = 0; y < state.dimension; y += 1) {
      for (let z = 0; z < state.dimension; z += 1) {
        if (!isSurfaceCubie(state.dimension, x, y, z)) {
          continue
        }

        const faceMaterials = FACE_ORDER.map((face) => {
          const sticker = getStickerColor(state, face, x, y, z)
          const color = sticker ? STICKER_COLORS[sticker] : INTERNAL_COLOR
          return new MeshStandardMaterial({ color: new Color(color) })
        })

        const cubie = new Mesh(geometry, faceMaterials as Material[])
        cubie.position.set((x - offset) * spacing, (y - offset) * spacing, (z - offset) * spacing)
        group.add(cubie)
      }
    }
  }

  group.rotation.y = Math.PI / 4
  group.rotation.x = -Math.PI / 7

  return group
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
