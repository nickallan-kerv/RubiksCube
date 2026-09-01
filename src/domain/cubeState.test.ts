import { describe, expect, it } from 'vitest'
import { createSolvedCubeState } from './cubeState'

describe('createSolvedCubeState', () => {
  it('generates a solved 2x2 state', () => {
    const cube = createSolvedCubeState(2)

    expect(cube.dimension).toBe(2)
    expect(cube.faces.U).toEqual([
      ['W', 'W'],
      ['W', 'W'],
    ])
    expect(cube.faces.F).toEqual([
      ['R', 'R'],
      ['R', 'R'],
    ])
  })

  it('generates a solved 3x3 state', () => {
    const cube = createSolvedCubeState(3)

    expect(cube.dimension).toBe(3)
    expect(cube.faces.R[1][1]).toBe('G')
    expect(cube.faces.B[2][0]).toBe('B')
  })

  it('generates a solved 4x4 state', () => {
    const cube = createSolvedCubeState(4)

    expect(cube.dimension).toBe(4)
    expect(cube.faces.L).toHaveLength(4)
    expect(cube.faces.L[0]).toHaveLength(4)
    expect(cube.faces.D[3][3]).toBe('Y')
  })
})
