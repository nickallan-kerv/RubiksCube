import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import {
  inferDragTurnMove,
  mapAxisIndexToLayer,
  resolveDragIntent,
  resolveTopBottomHorizontalTurn,
} from './faceTurnInteractionController'

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

describe('inferDragTurnMove', () => {
  it('keeps fallback behavior face-local when geometric resolver is unavailable', () => {
    expect(inferDragTurnMove('F', 24, 0)).toEqual({
      face: 'F',
      direction: 'CCW',
      layer: 0,
    })
  })
})

describe('resolveDragIntent', () => {
  it('maps right-face drag on upper row to U outer layer', () => {
    const resolved = resolveDragIntent('R', 4, 3, 3, 2, new Vector3(0.2, 0.1, 1.0))

    expect(resolved?.move).toEqual({
      face: 'U',
      direction: 'CW',
      layer: 0,
    })
    expect(resolved?.dragAxis).toBe('z')
    expect(resolved?.rotationAxis).toBe('y')
  })

  it('maps right-face drag on lower row to D outer layer', () => {
    const resolved = resolveDragIntent('R', 4, 3, 0, 2, new Vector3(0.2, 0.1, 1.0))

    expect(resolved?.move).toEqual({
      face: 'D',
      direction: 'CCW',
      layer: 0,
    })
  })

  it('returns null for tiny projected drag component', () => {
    expect(resolveDragIntent('F', 3, 2, 2, 2, new Vector3(0, 0, 0))).toBeNull()
  })

  it('honors preferred drag axis on U face for horizontal screen intent', () => {
    const resolved = resolveDragIntent('U', 4, 2, 3, 2, new Vector3(0.05, 0, 1.0), 'z')

    expect(resolved?.dragAxis).toBe('z')
    expect(resolved?.rotationAxis).toBe('x')
    expect(resolved?.move.face).toBe('F')
  })

  it('resolves top middle-band horizontal drag to a middle slice', () => {
    const resolved = resolveDragIntent('U', 3, 1, 2, 1, new Vector3(0.8, 0, 0.2), 'x')

    expect(resolved?.move.face).toBe('F')
    expect(resolved?.move.layer).toBe(1)
  })

})

describe('resolveTopBottomHorizontalTurn', () => {
  it('top-band left column rightward drag', () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 0, 2, 80)

    expect(resolved.move.face).toBe('U')
    expect(resolved.move.layer).toBe(0)
    expect(resolved.rotationAxis).toBe('y')
  })

  it('top-band left column leftward drag', () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 0, 2, -80)

    expect(resolved.move.face).toBe('U')
    expect(resolved.move.layer).toBe(0)
    expect(resolved.rotationAxis).toBe('y')
  })

  it('top-band middle column rightward drag', () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 1, 2, 80)

    expect(resolved.move.face).toBe('U')
    expect(resolved.move.layer).toBe(1)
    expect(resolved.rotationAxis).toBe('y')
  })

  it('top-band middle column leftward drag', () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 1, 2, -80)

    expect(resolved.move.face).toBe('U')
    expect(resolved.move.layer).toBe(1)
    expect(resolved.rotationAxis).toBe('y')
  })

  it('top-band right column rightward drag', () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 2, 2, 80)

    expect(resolved.move.face).toBe('U')
    expect(resolved.move.layer).toBe(0)
    expect(resolved.rotationAxis).toBe('y')
  })

  it('top-band right column leftward drag', () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 2, 2, -80)

    expect(resolved.move.face).toBe('U')
    expect(resolved.move.layer).toBe(0)
    expect(resolved.rotationAxis).toBe('y')
  })

  it('returns middle layer for center column on larger odd cubes', () => {
    const resolved = resolveTopBottomHorizontalTurn(5, 2, 4, 80)

    expect(resolved.move.layer).toBe(2)
  })
})

describe('resolveDragIntent top-face horizontal gestures', () => {
  it.each([
    {
      name: 'left column rightward (front depth)',
      x: 0,
      z: 2,
      dragZ: 1,
      face: 'F',
      direction: 'CW',
      layer: 0,
    },
    {
      name: 'left column leftward (middle depth)',
      x: 0,
      z: 1,
      dragZ: -1,
      face: 'F',
      direction: 'CW',
      layer: 1,
    },
    {
      name: "left column leftward (front depth) resolves to 2R",
      x: 0,
      z: 2,
      dragZ: -1,
      face: 'R',
      direction: 'CW',
      layer: 1,
    },
    {
      name: 'left column rightward (middle depth)',
      x: 0,
      z: 1,
      dragZ: 1,
      face: 'F',
      direction: 'CW',
      layer: 1,
    },
    {
      name: 'left column rightward (back depth) resolves to L',
      x: 0,
      z: 0,
      dragZ: 1,
      face: 'L',
      direction: 'CW',
      layer: 0,
    },
    {
      name: 'middle column rightward',
      x: 1,
      z: 1,
      dragZ: 1,
      face: 'F',
      direction: 'CW',
      layer: 1,
    },
    {
      name: "middle column rightward (back depth) resolves to 2R'",
      x: 1,
      z: 0,
      dragZ: 1,
      face: 'R',
      direction: 'CCW',
      layer: 1,
    },
    {
      name: 'middle column leftward',
      x: 1,
      z: 1,
      dragZ: -1,
      face: 'F',
      direction: 'CW',
      layer: 1,
    },
    {
      name: 'right column rightward',
      x: 2,
      z: 2,
      dragZ: 1,
      face: 'R',
      direction: 'CCW',
      layer: 0,
    },
    {
      name: 'right column leftward (front depth)',
      x: 2,
      z: 2,
      dragZ: -1,
      face: 'F',
      direction: 'CCW',
      layer: 0,
    },
    {
      name: 'right column leftward (back depth) resolves to B',
      x: 2,
      z: 0,
      dragZ: -1,
      face: 'R',
      direction: 'CW',
      layer: 0,
    },
    {
      name: 'middle column leftward (back depth) resolves to 2R',
      x: 1,
      z: 0,
      dragZ: -1,
      face: 'R',
      direction: 'CW',
      layer: 1,
    },
    {
      name: "left column leftward (back depth) resolves to L'",
      x: 0,
      z: 0,
      dragZ: -1,
      face: 'L',
      direction: 'CCW',
      layer: 0,
    },
  ])('$name', ({ x, z, dragZ, face, direction, layer }) => {
    const resolved = resolveDragIntent('U', 3, x, 2, z, new Vector3(0, 0, dragZ), 'z')

    expect(resolved?.move.face).toBe(face)
    expect(resolved?.move.direction).toBe(direction)
    expect(resolved?.move.layer).toBe(layer)
    expect(resolved?.rotationAxis).toBe('x')
  })
})

describe('resolveDragIntent top-face vertical gestures', () => {
  it.each([
    {
      name: 'left column upward on back depth',
      x: 0,
      z: 0,
      dragX: 1,
      face: 'B',
      direction: 'CCW',
      layer: 0,
    },
    {
      name: 'left column downward on back depth',
      x: 0,
      z: 0,
      dragX: -1,
      face: 'B',
      direction: 'CW',
      layer: 0,
    },
    {
      name: 'middle column upward on middle depth',
      x: 1,
      z: 1,
      dragX: 1,
      face: 'F',
      direction: 'CW',
      layer: 1,
    },
    {
      name: 'middle column downward on middle depth',
      x: 1,
      z: 1,
      dragX: -1,
      face: 'F',
      direction: 'CCW',
      layer: 1,
    },
    {
      name: 'right column upward on front depth',
      x: 2,
      z: 2,
      dragX: 1,
      face: 'F',
      direction: 'CW',
      layer: 0,
    },
    {
      name: 'right column downward on front depth',
      x: 2,
      z: 2,
      dragX: -1,
      face: 'F',
      direction: 'CCW',
      layer: 0,
    },
  ])('$name', ({ x, z, dragX, face, direction, layer }) => {
    const resolved = resolveDragIntent('U', 3, x, 2, z, new Vector3(dragX, 0, 0), 'x')

    expect(resolved?.move.face).toBe(face)
    expect(resolved?.move.direction).toBe(direction)
    expect(resolved?.move.layer).toBe(layer)
    expect(resolved?.rotationAxis).toBe('z')
  })
})

describe('top-face runtime parity gestures', () => {
  it.each([
    {
      name: 'top-front left-to-right',
      x: 1,
      z: 2,
      drag: new Vector3(0, 0, 1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'F', direction: 'CW', layer: 1 },
    },
    {
      name: 'top-back right-to-left resolves to 2R',
      x: 1,
      z: 0,
      drag: new Vector3(0, 0, -1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'R', direction: 'CW', layer: 1 },
    },
    {
      name: 'top-left left-to-right',
      x: 0,
      z: 2,
      drag: new Vector3(0, 0, 1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'F', direction: 'CW', layer: 0 },
    },
    {
      name: 'top-left front-depth right-to-left resolves to 2R',
      x: 0,
      z: 2,
      drag: new Vector3(0, 0, -1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'R', direction: 'CW', layer: 1 },
    },
    {
      name: 'top-left middle-depth left-to-right',
      x: 0,
      z: 1,
      drag: new Vector3(0, 0, 1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'F', direction: 'CW', layer: 1 },
    },
    {
      name: 'top-left back-depth left-to-right resolves to L',
      x: 0,
      z: 0,
      drag: new Vector3(0, 0, 1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'L', direction: 'CW', layer: 0 },
    },
    {
      name: 'top-right right-to-left',
      x: 2,
      z: 2,
      drag: new Vector3(0, 0, -1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'F', direction: 'CCW', layer: 0 },
    },
    {
      name: 'top-right back-depth right-to-left resolves to R',
      x: 2,
      z: 0,
      drag: new Vector3(0, 0, -1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'R', direction: 'CW', layer: 0 },
    },
    {
      name: 'top-middle left-to-right',
      x: 1,
      z: 1,
      drag: new Vector3(0, 0, 1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'F', direction: 'CW', layer: 1 },
    },
    {
      name: "top-middle back-depth left-to-right resolves to 2R'",
      x: 1,
      z: 0,
      drag: new Vector3(0, 0, 1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'R', direction: 'CCW', layer: 1 },
    },
    {
      name: 'top-middle right-to-left',
      x: 1,
      z: 1,
      drag: new Vector3(0, 0, -1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'F', direction: 'CW', layer: 1 },
    },
    {
      name: "top-left back-depth right-to-left resolves to L'",
      x: 0,
      z: 0,
      drag: new Vector3(0, 0, -1),
      preferredDragAxis: 'z' as const,
      expected: { face: 'L', direction: 'CCW', layer: 0 },
    },
    {
      name: 'top-left upward on back depth',
      x: 0,
      z: 0,
      drag: new Vector3(1, 0, 0),
      preferredDragAxis: 'x' as const,
      expected: { face: 'B', direction: 'CCW', layer: 0 },
    },
  ])('$name', ({ x, z, drag, preferredDragAxis, expected }) => {
    const resolved = resolveDragIntent('U', 3, x, 2, z, drag, preferredDragAxis)

    expect(resolved).not.toBeNull()
    expect(resolved?.move.face).toBe(expected.face)
    expect(resolved?.move.direction).toBe(expected.direction)
    expect(resolved?.move.layer).toBe(expected.layer)
  })
})

describe('user reported gesture regressions', () => {
  it("left-face top-row left-to-right resolves to U'", () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 0, 2, 80)

    expect(resolved.move.face).toBe('U')
    expect(resolved.move.direction).toBe('CCW')
    expect(resolved.move.layer).toBe(0)
  })

  it("front-face top-row left-column left-to-right resolves to U'", () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 0, 2, 80)

    expect(resolved.move.face).toBe('U')
    expect(resolved.move.layer).toBe(0)
  })

  it("front-top left-to-right resolves to U'", () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 0, 2, 80)

    expect(resolved.move.face).toBe('U')
    expect(resolved.move.direction).toBe('CCW')
    expect(resolved.move.layer).toBe(0)
  })

  it('front-bottom left-to-right resolves to D', () => {
    const resolved = resolveTopBottomHorizontalTurn(3, 0, 0, 80)

    expect(resolved.move.face).toBe('D')
    expect(resolved.move.direction).toBe('CW')
    expect(resolved.move.layer).toBe(0)
  })

  it('front-face top-left left-to-right resolves to D outer', () => {
    const resolved = resolveDragIntent('F', 3, 0, 2, 2, new Vector3(1, 0, 0), 'x')

    expect(resolved?.move.face).toBe('D')
    expect(resolved?.move.layer).toBe(0)
  })

  it('front-face middle left-to-right resolves to D', () => {
    const resolved = resolveDragIntent('F', 3, 1, 1, 2, new Vector3(1, 0, 0), 'x')

    expect(resolved?.move.face).toBe('D')
  })

  it('front-face middle-left left-to-right resolves to D', () => {
    const resolved = resolveDragIntent('F', 3, 0, 1, 2, new Vector3(1, 0, 0), 'x')

    expect(resolved?.move.face).toBe('D')
  })

})
