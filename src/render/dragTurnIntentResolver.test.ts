import { describe, expect, it } from 'vitest'
import { Vector2, Vector3 } from 'three'
import {
  physicalTurnToMove,
  resolveDragTurnIntent,
  type Axis,
  type AxisSign,
  type ProjectedTangent,
} from './dragTurnIntentResolver'

interface GestureFamily {
  name: string
  normal: Vector3
  tangentAxis: Axis
  tangent: Vector3
  otherAxis: Axis
  otherTangent: Vector3
  rotationAxis: Axis
  positiveRotationSign: AxisSign
}

const GESTURE_FAMILIES: GestureFamily[] = [
  {
    name: 'front face horizontal',
    normal: new Vector3(0, 0, 1),
    tangentAxis: 'x',
    tangent: new Vector3(1, 0, 0),
    otherAxis: 'y',
    otherTangent: new Vector3(0, 1, 0),
    rotationAxis: 'y',
    positiveRotationSign: 1,
  },
  {
    name: 'front face vertical',
    normal: new Vector3(0, 0, 1),
    tangentAxis: 'y',
    tangent: new Vector3(0, 1, 0),
    otherAxis: 'x',
    otherTangent: new Vector3(1, 0, 0),
    rotationAxis: 'x',
    positiveRotationSign: -1,
  },
  {
    name: 'top face x tangent',
    normal: new Vector3(0, 1, 0),
    tangentAxis: 'x',
    tangent: new Vector3(1, 0, 0),
    otherAxis: 'z',
    otherTangent: new Vector3(0, 0, 1),
    rotationAxis: 'z',
    positiveRotationSign: -1,
  },
  {
    name: 'top face z tangent',
    normal: new Vector3(0, 1, 0),
    tangentAxis: 'z',
    tangent: new Vector3(0, 0, 1),
    otherAxis: 'x',
    otherTangent: new Vector3(1, 0, 0),
    rotationAxis: 'x',
    positiveRotationSign: 1,
  },
  {
    name: 'left face vertical',
    normal: new Vector3(-1, 0, 0),
    tangentAxis: 'y',
    tangent: new Vector3(0, 1, 0),
    otherAxis: 'z',
    otherTangent: new Vector3(0, 0, 1),
    rotationAxis: 'z',
    positiveRotationSign: -1,
  },
  {
    name: 'left face depth tangent',
    normal: new Vector3(-1, 0, 0),
    tangentAxis: 'z',
    tangent: new Vector3(0, 0, 1),
    otherAxis: 'y',
    otherTangent: new Vector3(0, 1, 0),
    rotationAxis: 'y',
    positiveRotationSign: 1,
  },
]

describe('resolveDragTurnIntent', () => {
  it.each(
    GESTURE_FAMILIES.flatMap((family) =>
      [0, 1, 2].flatMap((axisIndex) =>
        ([1, -1] as AxisSign[]).map((dragSign) => ({ family, axisIndex, dragSign })),
      ),
    ),
  )('$family.name, layer coordinate $axisIndex, sign $dragSign', ({ family, axisIndex, dragSign }) => {
    const coordinate = { x: 1, y: 1, z: 1 }
    coordinate[family.rotationAxis] = axisIndex
    const tangents: [ProjectedTangent, ProjectedTangent] = [
      {
        axis: family.tangentAxis,
        localDirection: family.tangent,
        screenDirection: new Vector2(1, 0),
      },
      {
        axis: family.otherAxis,
        localDirection: family.otherTangent,
        screenDirection: new Vector2(0, 1),
      },
    ]

    const resolved = resolveDragTurnIntent({
      dimension: 3,
      coordinate,
      faceNormalLocal: family.normal,
      tangents,
      pointerDelta: new Vector2(24 * dragSign, 0),
      thresholdPx: 10,
      confidenceRatio: 1.2,
    })
    const expectedRotationSign = (family.positiveRotationSign * dragSign) as AxisSign

    expect(resolved).toEqual({
      move: physicalTurnToMove(family.rotationAxis, expectedRotationSign, axisIndex, 3),
      tangentAxis: family.tangentAxis,
      rotationAxis: family.rotationAxis,
      rotationSign: expectedRotationSign,
      axisIndex,
    })
  })

  it('does not resolve below the dead zone', () => {
    expect(resolveDragTurnIntent(createSimpleInput(new Vector2(9, 0)))).toBeNull()
  })

  it('does not resolve an ambiguous diagonal', () => {
    expect(resolveDragTurnIntent(createSimpleInput(new Vector2(20, 20)))).toBeNull()
  })

  it.each([2, 4])('selects every physical layer on a %ix%i cube', (dimension) => {
    for (let axisIndex = 0; axisIndex < dimension; axisIndex += 1) {
      const input = createSimpleInput(new Vector2(20, 0))
      input.dimension = dimension
      input.coordinate.y = axisIndex

      expect(resolveDragTurnIntent(input)?.axisIndex).toBe(axisIndex)
    }
  })

  it('maps neighbouring front and left face gestures to the same equator turn', () => {
    const frontGesture = resolveDragTurnIntent(createGestureInput(
      new Vector3(0, 0, 1),
      'x',
      new Vector3(1, 0, 0),
      'y',
      new Vector3(0, 1, 0),
      { x: 1, y: 1, z: 2 },
      1,
    ))
    const leftGesture = resolveDragTurnIntent(createGestureInput(
      new Vector3(-1, 0, 0),
      'z',
      new Vector3(0, 0, 1),
      'y',
      new Vector3(0, 1, 0),
      { x: 0, y: 1, z: 1 },
      1,
    ))

    expect(frontGesture).toMatchObject({ rotationAxis: 'y', rotationSign: 1, axisIndex: 1 })
    expect(leftGesture).toMatchObject({ rotationAxis: 'y', rotationSign: 1, axisIndex: 1 })
    expect(leftGesture?.move).toEqual(frontGesture?.move)
  })
})

function createSimpleInput(pointerDelta: Vector2) {
  return {
    dimension: 3,
    coordinate: { x: 1, y: 1, z: 2 },
    faceNormalLocal: new Vector3(0, 0, 1),
    tangents: [
      {
        axis: 'x' as const,
        localDirection: new Vector3(1, 0, 0),
        screenDirection: new Vector2(1, 0),
      },
      {
        axis: 'y' as const,
        localDirection: new Vector3(0, 1, 0),
        screenDirection: new Vector2(0, 1),
      },
    ] as const,
    pointerDelta,
    thresholdPx: 10,
    confidenceRatio: 1.2,
  }
}

function createGestureInput(
  normal: Vector3,
  tangentAxis: Axis,
  tangent: Vector3,
  otherAxis: Axis,
  otherTangent: Vector3,
  coordinate: { x: number; y: number; z: number },
  dragSign: AxisSign,
) {
  return {
    dimension: 3,
    coordinate,
    faceNormalLocal: normal,
    tangents: [
      { axis: tangentAxis, localDirection: tangent, screenDirection: new Vector2(1, 0) },
      { axis: otherAxis, localDirection: otherTangent, screenDirection: new Vector2(0, 1) },
    ],
    pointerDelta: new Vector2(20 * dragSign, 0),
    thresholdPx: 10,
    confidenceRatio: 1.2,
  } as const
}