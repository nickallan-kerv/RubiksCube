import { describe, expect, it } from 'vitest'
import { Group, Matrix4, PerspectiveCamera, Vector3 } from 'three'
import { projectFaceTangents } from './dragTurnIntentResolver'

describe('projectFaceTangents', () => {
  it.each([
    { position: new Vector3(6, 7, 8), aspect: 1 },
    { position: new Vector3(-7, 5, 9), aspect: 16 / 9 },
    { position: new Vector3(8, 3, -7), aspect: 9 / 16 },
  ])('projects two distinct face tangents from camera $position', ({ position, aspect }) => {
    const camera = createCamera(position, aspect)
    const cube = new Group()
    cube.rotation.x = Math.PI / 2
    cube.updateMatrixWorld(true)
    const hitPoint = new Vector3(0, 0, 1).applyMatrix4(cube.matrixWorld)

    const tangents = projectFaceTangents(
      new Vector3(0, 0, 1),
      hitPoint,
      cube.matrixWorld,
      camera,
      { width: 800 * aspect, height: 800 },
    )

    expect(tangents).not.toBeNull()
    expect(tangents?.map((tangent) => tangent.axis)).toEqual(['x', 'y'])
    expect(Math.abs(tangents?.[0].screenDirection.dot(tangents[1].screenDirection) ?? 1)).toBeLessThan(0.999)
  })

  it('rejects a degenerate viewport', () => {
    const camera = createCamera(new Vector3(6, 7, 8), 1)

    expect(projectFaceTangents(
      new Vector3(0, 0, 1),
      new Vector3(),
      new Matrix4(),
      camera,
      { width: 0, height: 800 },
    )).toBeNull()
  })
})

function createCamera(position: Vector3, aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(38, aspect, 0.1, 100)
  camera.up.set(0, 0, 1)
  camera.position.copy(position)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return camera
}