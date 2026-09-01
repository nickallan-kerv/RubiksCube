import { describe, expect, it } from 'vitest'
import { CircleGeometry, Mesh, Vector3 } from 'three'
import { createMove } from '../domain/cubeNotation'
import { createSolvedCubeState } from '../domain/cubeState'
import { createCubeGroupFromState } from './cubieMeshFactory'
import { getCubieCoordinate, isCubieInTurnLayer, moveToPhysicalTurn } from './cubeTurnAnimation'

describe('createCubeGroupFromState animation metadata', () => {
  it.each([2, 3, 4])('assigns coordinates to every visible cubie on a %ix%i cube', (dimension) => {
    const group = createCubeGroupFromState(createSolvedCubeState(dimension))
    const expectedVisibleCubies = dimension ** 3 - Math.max(0, dimension - 2) ** 3

    expect(group.children).toHaveLength(expectedVisibleCubies)
    expect(group.children.every((cubie) => getCubieCoordinate(cubie) !== null)).toBe(true)
  })

  it('selects the exact outer and inner visible layers on a 4x4 cube', () => {
    const group = createCubeGroupFromState(createSolvedCubeState(4))
    const outer = moveToPhysicalTurn(createMove('R', 0, 'CW'), 4)
    const inner = moveToPhysicalTurn(createMove('R', 1, 'CW'), 4)

    expect(group.children.filter((cubie) => isCubieInTurnLayer(cubie, outer))).toHaveLength(16)
    expect(group.children.filter((cubie) => isCubieInTurnLayer(cubie, inner))).toHaveLength(12)
  })

  it('maps the cube upper face to world positive Z', () => {
    const group = createCubeGroupFromState(createSolvedCubeState(3))
    const worldUp = new Vector3(0, 1, 0).applyQuaternion(group.quaternion)

    expect(worldUp.x).toBeCloseTo(0)
    expect(worldUp.y).toBeCloseTo(0)
    expect(worldUp.z).toBeCloseTo(1)
  })

  it.each([2, 3, 4])('creates exactly six face grids of circular stickers on a %ix%i cube', (dimension) => {
    const group = createCubeGroupFromState(createSolvedCubeState(dimension))
    const stickers = group.children.flatMap((cubie) => cubie.children)

    expect(stickers).toHaveLength(6 * dimension * dimension)
    expect(stickers.every((sticker) => sticker instanceof Mesh && sticker.geometry.type === 'CircleGeometry')).toBe(true)
  })

  it('keeps black cubie bodies as direct animation targets', () => {
    const group = createCubeGroupFromState(createSolvedCubeState(3))

    expect(group.children.every((cubie) => cubie instanceof Mesh)).toBe(true)
    expect(group.children.every((cubie) => (cubie as Mesh).geometry.userData.selectiveExternalBevel === true)).toBe(true)
    expect(group.children.every((cubie) => getCubieCoordinate(cubie) !== null)).toBe(true)
  })

  it('sizes stickers to fill most of each cubie face', () => {
    const group = createCubeGroupFromState(createSolvedCubeState(3))
    const sticker = group.children.flatMap((cubie) => cubie.children)[0] as Mesh

    expect(sticker.geometry).toBeInstanceOf(CircleGeometry)
    expect((sticker.geometry as CircleGeometry).parameters.radius).toBeGreaterThanOrEqual(0.4)
  })
})