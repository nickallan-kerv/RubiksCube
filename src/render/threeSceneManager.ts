import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'

export class ThreeSceneManager {
  private readonly container: HTMLElement
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly renderer: WebGLRenderer
  private contentGroup: Group | null
  private readonly resizeObserver: ResizeObserver

  public constructor(container: HTMLElement) {
    this.container = container
    this.scene = new Scene()
    this.scene.background = new Color('#f6f4ec')

    this.camera = new PerspectiveCamera(38, 1, 0.1, 100)
    // Start in an oblique top/front-left perspective to match the expected default viewport.
    this.camera.position.set(-0.4, 8.2, 6.9)
    this.camera.lookAt(0.35, -0.4, 0)

    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.container.appendChild(this.renderer.domElement)

    this.contentGroup = null

    const ambientLight = new AmbientLight('#ffffff', 0.7)
    const keyLight = new DirectionalLight('#ffffff', 0.9)
    keyLight.position.set(7, 10, 6)

    const fillLight = new DirectionalLight('#ffd9ac', 0.35)
    fillLight.position.set(-8, 5, -6)

    this.scene.add(ambientLight)
    this.scene.add(keyLight)
    this.scene.add(fillLight)

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

  public dispose(): void {
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
