import { describe, expect, it } from 'vitest'
import { createMove, invertMove, moveToNotation } from './cubeNotation'

describe('cube move notation', () => {
  it('represents standard outer layer moves', () => {
    const move = createMove('R', 0, 'CW')
    expect(moveToNotation(move)).toBe('R')
  })

  it('represents inverse and double turns', () => {
    const inverse = createMove('U', 0, 'CCW')
    const doubleTurn = createMove('F', 0, 'CW', 2)

    expect(moveToNotation(inverse)).toBe("U'")
    expect(moveToNotation(doubleTurn)).toBe('F2')
  })

  it('represents inner layer turns for NxN cubes', () => {
    const move = createMove('R', 1, 'CW')
    expect(moveToNotation(move)).toBe('2R')
  })

  it('can invert a quarter turn', () => {
    const move = createMove('L', 0, 'CW')
    const inverted = invertMove(move)

    expect(inverted.direction).toBe('CCW')
    expect(moveToNotation(inverted)).toBe("L'")
  })
})
