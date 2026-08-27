import {
  Matrix3,
  MOUSE,
  Raycaster,
  Vector2,
  type Intersection,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createMove, type CubeMove, type FaceName, type TurnDirection } from '../domain/cubeNotation'

interface DragStart {
  clientX: number
  clientY: number
  face: FaceName
}

const DRAG_THRESHOLD_PX = 10

export class FaceTurnInteractionController {
  private readonly canvas: HTMLCanvasElement
  private readonly camera: PerspectiveCamera
  private readonly getTurnTargets: () => Mesh[]
  private readonly onFaceTurn: (move: CubeMove) => void
  private readonly requestRender: () => void
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly controls: OrbitControls
  private dragStart: DragStart | null = null

  public constructor(
    canvas: HTMLCanvasElement,
    camera: PerspectiveCamera,
    getTurnTargets: () => Mesh[],
    onFaceTurn: (move: CubeMove) => void,
    requestRender: () => void,
  ) {
    this.canvas = canvas
    this.camera = camera
    this.getTurnTargets = getTurnTargets
    this.onFaceTurn = onFaceTurn
    this.requestRender = requestRender

    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = false
    this.controls.enablePan = false
    this.controls.mouseButtons.LEFT = null
    this.controls.mouseButtons.RIGHT = MOUSE.ROTATE
    this.controls.mouseButtons.MIDDLE = MOUSE.DOLLY
    this.controls.addEventListener('change', () => this.requestRender())

    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('pointerleave', this.handlePointerCancel)
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel)
  }

  public dispose(): void {
    this.controls.dispose()
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointerleave', this.handlePointerCancel)
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel)
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return
    }

    const intersection = this.getIntersection(event.clientX, event.clientY)
    if (!intersection) {
      this.dragStart = null
      return
    }

    this.dragStart = {
      clientX: event.clientX,
      clientY: event.clientY,
      face: this.extractFaceFromIntersection(intersection),
    }
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragStart || event.button !== 0) {
      this.dragStart = null
      return
    }

    const start = this.dragStart

    const deltaX = event.clientX - start.clientX
    const deltaY = event.clientY - start.clientY
    this.dragStart = null

    if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
      return
    }

    const direction = inferTurnDirection(start.face, deltaX, deltaY)
    const move = createMove(start.face, 0, direction)
    this.onFaceTurn(move)
  }

  private handlePointerCancel = (): void => {
    this.dragStart = null
  }

  private getIntersection(clientX: number, clientY: number): Intersection<Object3D> | null {
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.pointer.set(x, y)

    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersections = this.raycaster.intersectObjects(this.getTurnTargets(), false)
    return intersections[0] ?? null
  }

  private extractFaceFromIntersection(intersection: Intersection<Object3D>): FaceName {
    const mesh = intersection.object as Mesh
    const faceNormal = intersection.face?.normal
    if (!faceNormal) {
      return 'F'
    }

    const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld)
    const worldNormal = faceNormal.clone().applyMatrix3(normalMatrix).normalize()

    const absX = Math.abs(worldNormal.x)
    const absY = Math.abs(worldNormal.y)
    const absZ = Math.abs(worldNormal.z)

    if (absX >= absY && absX >= absZ) {
      return worldNormal.x >= 0 ? 'R' : 'L'
    }

    if (absY >= absX && absY >= absZ) {
      return worldNormal.y >= 0 ? 'U' : 'D'
    }

    return worldNormal.z >= 0 ? 'F' : 'B'
  }
}

function inferTurnDirection(face: FaceName, deltaX: number, deltaY: number): TurnDirection {
  const horizontal = Math.abs(deltaX) >= Math.abs(deltaY)
  let direction: TurnDirection

  if (horizontal) {
    const right = deltaX > 0
    switch (face) {
      case 'F':
      case 'U':
      case 'R':
        direction = right ? 'CW' : 'CCW'
        break
      case 'B':
      case 'D':
      case 'L':
        direction = right ? 'CCW' : 'CW'
        break
      default:
        direction = 'CW'
        break
    }
  } else {
    const down = deltaY > 0
    switch (face) {
      case 'F':
      case 'D':
      case 'L':
        direction = down ? 'CCW' : 'CW'
        break
      case 'B':
      case 'U':
      case 'R':
        direction = down ? 'CW' : 'CCW'
        break
      default:
        direction = 'CW'
        break
    }
  }

  return direction === 'CW' ? 'CCW' : 'CW'
}
