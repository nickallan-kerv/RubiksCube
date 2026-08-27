import { describe, expect, it } from 'vitest'
import { createMove, invertMove } from './cubeNotation'
import { applyMove, applyMoves } from './cubeMoveEngine'
import { isSolvedCubeState } from './cubeSolved'
import { createSolvedCubeState } from './cubeState'

describe('cube move engine', () => {
  it('changes solved-state after a quarter turn', () => {
    const cube = createSolvedCubeState(3)
    const next = applyMove(cube, createMove('R', 0, 'CW'))

    expect(isSolvedCubeState(cube)).toBe(true)
    expect(isSolvedCubeState(next)).toBe(false)
  })

  it('returns to solved-state when applying inverse move', () => {
    const move = createMove('U', 0, 'CW')
    const cube = createSolvedCubeState(3)

    const moved = applyMove(cube, move)
    const restored = applyMove(moved, invertMove(move))

    expect(isSolvedCubeState(restored)).toBe(true)
    expect(restored).toEqual(cube)
  })

  it('supports inner-layer turns on 4x4', () => {
    const move = createMove('R', 1, 'CW')
    const cube = createSolvedCubeState(4)

    const moved = applyMove(cube, move)
    const restored = applyMove(moved, invertMove(move))

    expect(isSolvedCubeState(moved)).toBe(false)
    expect(isSolvedCubeState(restored)).toBe(true)
  })

  it('handles a sequence and exact inverse sequence', () => {
    const sequence = [
      createMove('R', 0, 'CW'),
      createMove('U', 0, 'CW'),
      createMove('F', 0, 'CCW'),
      createMove('L', 0, 'CW', 2),
    ]

    const inverse = [...sequence].reverse().map((move) => invertMove(move))
    const cube = createSolvedCubeState(2)

    const mixed = applyMoves(cube, sequence)
    const restored = applyMoves(mixed, inverse)

    expect(isSolvedCubeState(mixed)).toBe(false)
    expect(isSolvedCubeState(restored)).toBe(true)
    expect(restored).toEqual(cube)
  })
})
