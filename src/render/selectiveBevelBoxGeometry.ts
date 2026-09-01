import { BoxGeometry, type BufferGeometry, Vector3 } from 'three'
import type { FaceName } from '../domain/cubeNotation'

interface VertexSigns {
  x: -1 | 0 | 1
  y: -1 | 0 | 1
  z: -1 | 0 | 1
}

export function createSelectiveBevelBoxGeometry(
  size: number,
  segments: number,
  radius: number,
  exposedFaces: ReadonlySet<FaceName>,
): BufferGeometry {
  const totalSegments = segments * 2 + 1
  const geometry = new BoxGeometry(1, 1, 1, totalSegments, totalSegments, totalSegments).toNonIndexed()
  geometry.userData.selectiveExternalBevel = true

  const position = new Vector3()
  const roundedNormal = new Vector3()
  const originalNormal = new Vector3()
  const halfInnerSize = size / 2 - radius
  const halfSegmentSize = 0.5 / totalSegments
  const positions = geometry.attributes.position.array
  const normals = geometry.attributes.normal.array

  for (let index = 0; index < positions.length; index += 3) {
    position.fromArray(positions, index)
    originalNormal.fromArray(normals, index)
    const signs: VertexSigns = {
      x: Math.sign(position.x) as VertexSigns['x'],
      y: Math.sign(position.y) as VertexSigns['y'],
      z: Math.sign(position.z) as VertexSigns['z'],
    }
    const roundedAxes = getRoundedAxes(exposedFaces, signs)

    if (roundedAxes.length < 2) {
      positions[index] = position.x * size
      positions[index + 1] = position.y * size
      positions[index + 2] = position.z * size
      continue
    }

    roundedNormal.set(0, 0, 0)
    for (const axis of roundedAxes) {
      roundedNormal[axis] = position[axis] - signs[axis] * halfSegmentSize
    }
    roundedNormal.normalize()

    for (const axis of ['x', 'y', 'z'] as const) {
      positions[index + axisOffset(axis)] = roundedAxes.includes(axis)
        ? halfInnerSize * signs[axis] + roundedNormal[axis] * radius
        : position[axis] * size
    }

    const faceAxis = dominantAxis(originalNormal)
    if (roundedAxes.includes(faceAxis)) {
      normals[index] = roundedNormal.x
      normals[index + 1] = roundedNormal.y
      normals[index + 2] = roundedNormal.z
    }
  }

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function shouldBevelVertex(
  exposedFaces: ReadonlySet<FaceName>,
  signs: VertexSigns,
): boolean {
  return getRoundedAxes(exposedFaces, signs).length >= 2
}

function getRoundedAxes(exposedFaces: ReadonlySet<FaceName>, signs: VertexSigns): Array<'x' | 'y' | 'z'> {
  const axes: Array<'x' | 'y' | 'z'> = []
  if (exposedFaces.has(signs.x > 0 ? 'R' : 'L')) {
    axes.push('x')
  }
  if (exposedFaces.has(signs.y > 0 ? 'U' : 'D')) {
    axes.push('y')
  }
  if (exposedFaces.has(signs.z > 0 ? 'F' : 'B')) {
    axes.push('z')
  }
  return axes
}

function dominantAxis(vector: Vector3): 'x' | 'y' | 'z' {
  if (Math.abs(vector.x) >= Math.abs(vector.y) && Math.abs(vector.x) >= Math.abs(vector.z)) {
    return 'x'
  }
  return Math.abs(vector.y) >= Math.abs(vector.z) ? 'y' : 'z'
}

function axisOffset(axis: 'x' | 'y' | 'z'): 0 | 1 | 2 {
  return axis === 'x' ? 0 : axis === 'y' ? 1 : 2
}