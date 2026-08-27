import { describe, expect, it } from 'vitest'
import { REVISION, Scene } from 'three'

describe('project foundation', () => {
  it('loads Three.js', () => {
    expect(REVISION.length).toBeGreaterThan(0)
    expect(new Scene()).toBeInstanceOf(Scene)
  })
})
