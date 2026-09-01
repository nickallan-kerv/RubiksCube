import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import { createMove } from '../domain/cubeNotation'
import {
  easeInOutCubic,
  isCubieInTurnLayer,
  moveToPhysicalTurn,
  setCubieCoordinate,
} from './cubeTurnAnimation'

describe('moveToPhysicalTurn', () => {
  it.each([
    ['R', 'x', 3, -1],
    ['L', 'x', 0, 1],
    ['U', 'y', 3, -1],
    ['D', 'y', 0, 1],
    ['F', 'z', 3, -1],
    ['B', 'z', 0, 1],
  ] as const)('maps %s clockwise to its physical rotation', (face, axis, coordinate, angleSign) => {
    const turn = moveToPhysicalTurn(createMove(face, 0, 'CW'), 4)

    expect(turn.axis).toBe(axis)
    expect(turn.coordinate).toBe(coordinate)
    expect(turn.angleRadians).toBeCloseTo(angleSign * Math.PI / 2)
  })

  it.each(['R', 'L', 'U', 'D', 'F', 'B'] as const)('reverses %s counter-clockwise', (face) => {
    const clockwise = moveToPhysicalTurn(createMove(face, 1, 'CW'), 4)
    const counterClockwise = moveToPhysicalTurn(createMove(face, 1, 'CCW'), 4)

    expect(counterClockwise.coordinate).toBe(clockwise.coordinate)
    expect(counterClockwise.angleRadians).toBeCloseTo(-clockwise.angleRadians)
  })

  it('maps inner layers and double turns exactly', () => {
    expect(moveToPhysicalTurn(createMove('R', 1, 'CW'), 4).coordinate).toBe(2)
    expect(moveToPhysicalTurn(createMove('L', 1, 'CW'), 4).coordinate).toBe(1)
    expect(Math.abs(moveToPhysicalTurn(createMove('F', 0, 'CW', 2), 3).angleRadians)).toBeCloseTo(Math.PI)
  })
})

describe('isCubieInTurnLayer', () => {
  it('selects cubies by stable coordinate metadata', () => {
    const cubies = Array.from({ length: 4 }, (_, x) => {
      const cubie = new Object3D()
      setCubieCoordinate(cubie, { x, y: 2, z: 3 })
      return cubie
    })
    const turn = moveToPhysicalTurn(createMove('R', 1, 'CW'), 4)

    expect(cubies.filter((cubie) => isCubieInTurnLayer(cubie, turn))).toEqual([cubies[2]])
  })

  it('rejects objects without cubie metadata', () => {
    expect(isCubieInTurnLayer(new Object3D(), moveToPhysicalTurn(createMove('U', 0, 'CW'), 3))).toBe(false)
  })
})

describe('easeInOutCubic', () => {
  it('clamps endpoints and preserves the midpoint', () => {
    expect(easeInOutCubic(-1)).toBe(0)
    expect(easeInOutCubic(0.5)).toBe(0.5)
    expect(easeInOutCubic(2)).toBe(1)
  })
})