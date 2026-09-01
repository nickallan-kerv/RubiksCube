import { describe, expect, it } from 'vitest'
import { createSelectiveBevelBoxGeometry, shouldBevelVertex } from './selectiveBevelBoxGeometry'

describe('selective external-edge bevels', () => {
  it('bevels only vertices where two exposed puzzle faces meet', () => {
    const exposedFaces = new Set(['R', 'U'] as const)

    expect(shouldBevelVertex(exposedFaces, { x: 1, y: 1, z: 1 })).toBe(true)
    expect(shouldBevelVertex(exposedFaces, { x: 1, y: -1, z: 1 })).toBe(false)
    expect(shouldBevelVertex(exposedFaces, { x: -1, y: 1, z: 1 })).toBe(false)
  })

  it('keeps a cubie with only one exposed face square', () => {
    const geometry = createSelectiveBevelBoxGeometry(0.95, 4, 0.07, new Set(['F']))
    const positions = geometry.attributes.position.array
    const maximum = Math.max(...Array.from(positions, Math.abs))

    expect(maximum).toBeCloseTo(0.475)
    expect(geometry.userData.selectiveExternalBevel).toBe(true)
  })
})