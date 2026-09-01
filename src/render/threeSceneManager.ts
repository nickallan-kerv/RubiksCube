import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import type { CubeMove } from '../domain/cubeNotation'
import { easeInOutCubic, isCubieInTurnLayer, moveToPhysicalTurn } from './cubeTurnAnimation'

export class ThreeSceneManager {
  private readonly container: HTMLElement
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly renderer: WebGLRenderer
  private contentGroup: Group | null
  private readonly resizeObserver: ResizeObserver
  private cancelActiveAnimation: (() => void) | null = null

  public constructor(container: HTMLElement) {
    this.container = container
    this.scene = new Scene()
    this.scene.background = new Color('#f6f4ec')

    this.camera = new PerspectiveCamera(38, 1, 0.1, 100)
    this.camera.up.set(0, 0, 1)
    this.camera.position.set(-3.65, -4.9, 4.25)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.container.appendChild(this.renderer.domElement)

    this.contentGroup = null

    const ambientLight = new AmbientLight('#ffffff', 0.35)
    const keyLight = new DirectionalLight('#fffdf8', 1.15)
    keyLight.position.set(-6, -8, 10)

    const fillLight = new DirectionalLight('#eef4ff', 0.7)
    fillLight.position.set(8, -3, 6)

    const rimLight = new DirectionalLight('#ffffff', 0.85)
    rimLight.position.set(1, 9, 8)

    this.scene.add(ambientLight)
    this.scene.add(keyLight)
    this.scene.add(fillLight)
    this.scene.add(rimLight)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    this.resize()
    this.render()
  }

  public setContent(group: Group): void {
    if (this.contentGroup) {
      this.scene.remove(this.contentGroup)
    }

    this.contentGroup = group
    this.scene.add(group)
    this.render()
  }

  public getCamera(): PerspectiveCamera {
    return this.camera
  }

  public getCanvasElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  public getContentGroup(): Group | null {
    return this.contentGroup
  }

  public requestRender(): void {
    this.render()
  }

  public animateLayerTurn(move: CubeMove, dimension: number, durationMs: number): Promise<boolean> {
    this.cancelLayerTurn()
    const contentGroup = this.contentGroup
    if (!contentGroup) {
      return Promise.resolve(false)
    }

    const turn = moveToPhysicalTurn(move, dimension)
    const affectedCubies = contentGroup.children.filter((cubie) => isCubieInTurnLayer(cubie, turn))
    if (affectedCubies.length === 0) {
      return Promise.resolve(false)
    }

    const pivot = new Group()
    contentGroup.add(pivot)
    for (const cubie of affectedCubies) {
      contentGroup.remove(cubie)
      pivot.add(cubie)
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const effectiveDuration = reducedMotion ? 0 : Math.max(0, durationMs)

    return new Promise((resolve) => {
      let animationFrame = 0
      let startTime: number | null = null
      let settled = false

      const restoreOriginalCubieTransforms = (): void => {
        for (const cubie of affectedCubies) {
          pivot.remove(cubie)
          contentGroup.add(cubie)
        }
        contentGroup.remove(pivot)
      }

      const finish = (completed: boolean): void => {
        if (settled) {
          return
        }

        settled = true
        if (animationFrame !== 0) {
          cancelAnimationFrame(animationFrame)
        }
        restoreOriginalCubieTransforms()
        this.cancelActiveAnimation = null
        if (!completed) {
          this.render()
        }
        resolve(completed)
      }

      this.cancelActiveAnimation = () => finish(false)

      if (effectiveDuration === 0) {
        pivot.rotation[turn.axis] = turn.angleRadians
        this.render()
        finish(true)
        return
      }

      const animateFrame = (timestamp: number): void => {
        startTime ??= timestamp
        const progress = Math.min(1, (timestamp - startTime) / effectiveDuration)
        pivot.rotation[turn.axis] = turn.angleRadians * easeInOutCubic(progress)
        this.render()

        if (progress >= 1) {
          animationFrame = 0
          finish(true)
          return
        }

        animationFrame = requestAnimationFrame(animateFrame)
      }

      animationFrame = requestAnimationFrame(animateFrame)
    })
  }

  public cancelLayerTurn(): void {
    this.cancelActiveAnimation?.()
  }

  public dispose(): void {
    this.cancelLayerTurn()
    this.resizeObserver.disconnect()
    this.renderer.dispose()
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.render()
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera)
  }
}
