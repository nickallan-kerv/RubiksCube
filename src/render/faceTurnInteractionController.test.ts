import { describe, expect, it } from 'vitest'
import { mapAxisIndexToLayer } from './faceTurnInteractionController'

describe('mapAxisIndexToLayer', () => {
  it('maps positive faces with inverted axis index', () => {
    expect(mapAxisIndexToLayer('R', 0, 4)).toBe(3)
    expect(mapAxisIndexToLayer('U', 1, 4)).toBe(2)
    expect(mapAxisIndexToLayer('F', 3, 4)).toBe(0)
  })

  it('maps negative faces directly from axis index', () => {
    expect(mapAxisIndexToLayer('L', 0, 4)).toBe(0)
    expect(mapAxisIndexToLayer('D', 2, 4)).toBe(2)
    expect(mapAxisIndexToLayer('B', 3, 4)).toBe(3)
  })

  it('clamps out-of-range axis indices', () => {
    expect(mapAxisIndexToLayer('R', -10, 4)).toBe(3)
    expect(mapAxisIndexToLayer('L', 999, 4)).toBe(3)
  })
})
