import { createSolvedCubeState } from '../domain/cubeState'
import { applyMove } from '../domain/cubeMoveEngine'
import { createMove, type CubeMove } from '../domain/cubeNotation'
import { type Mesh } from 'three'
import { createCubeGroupFromState } from './cubieMeshFactory'
import { FaceTurnInteractionController } from './faceTurnInteractionController'
import { ThreeSceneManager } from './threeSceneManager'
import type { CubeState } from '../domain/cubeState'

interface QueuedMove {
  move: CubeMove
  countTowardsStats: boolean
  onComplete?: () => void
}

interface PlayMoveOptions {
  countTowardsStats?: boolean
  onComplete?: () => void
}

type MoveAppliedHandler = (state: CubeState, move: CubeMove, countTowardsStats: boolean) => void
type QueueStateHandler = (isBusy: boolean) => void

export class CubeViewportController {
  private readonly sceneManager: ThreeSceneManager
  private readonly interactionController: FaceTurnInteractionController
  private currentState = createSolvedCubeState(3)
  private readonly moveQueue: QueuedMove[] = []
  private isProcessingQueue = false
  private stepDelayMs = 240
  private onMoveApplied: MoveAppliedHandler | null = null
  private onQueueStateChanged: QueueStateHandler | null = null

  public constructor(container: HTMLElement) {
    this.sceneManager = new ThreeSceneManager(container)
    this.interactionController = new FaceTurnInteractionController(
      this.sceneManager.getCanvasElement(),
      this.sceneManager.getCamera(),
      () => this.getTurnTargets(),
      (move) => this.playMoves([move], { countTowardsStats: true }),
      () => !this.isBusy(),
      () => this.sceneManager.requestRender(),
    )
  }

  public setOnMoveApplied(handler: MoveAppliedHandler): void {
    this.onMoveApplied = handler
  }

  public setOnQueueStateChanged(handler: QueueStateHandler): void {
    this.onQueueStateChanged = handler
    handler(this.isBusy())
  }

  public isBusy(): boolean {
    return this.isProcessingQueue || this.moveQueue.length > 0
  }

  public renderSolvedCube(dimension: number): void {
    const wasBusy = this.isBusy()
    this.currentState = createSolvedCubeState(dimension)
    this.moveQueue.length = 0
    this.isProcessingQueue = false
    this.renderCurrentState()
    if (wasBusy) {
      this.onQueueStateChanged?.(false)
    }
  }

  public setStepDelay(stepDelayMs: number): void {
    if (Number.isFinite(stepDelayMs) && stepDelayMs >= 80) {
      this.stepDelayMs = stepDelayMs
    }
  }

  public playDemoSequence(): void {
    const dimension = this.currentState.dimension
    const innerLayer = dimension > 3 ? 1 : 0

    const sequence: CubeMove[] = [
      createMove('R', 0, 'CW'),
      createMove('U', 0, 'CW'),
      createMove('F', 0, 'CCW'),
      createMove('L', 0, 'CW', 2),
      createMove('D', 0, 'CCW'),
      createMove('B', 0, 'CW'),
      createMove('R', innerLayer, 'CW'),
    ]

    this.playMoves(sequence, { countTowardsStats: false })
  }

  public playMoves(moves: CubeMove[], options: PlayMoveOptions = {}): void {
    if (moves.length === 0) {
      options.onComplete?.()
      return
    }

    const wasBusy = this.isBusy()

    const countTowardsStats = options.countTowardsStats ?? true

    moves.forEach((move, index) => {
      const queueItem: QueuedMove = {
        move,
        countTowardsStats,
      }

      if (index === moves.length - 1 && options.onComplete) {
        queueItem.onComplete = options.onComplete
      }

      this.moveQueue.push(queueItem)
    })

    if (!wasBusy) {
      this.onQueueStateChanged?.(true)
    }

    if (!this.isProcessingQueue) {
      this.processQueue()
    }
  }

  private processQueue(): void {
    const nextQueueItem = this.moveQueue.shift()
    if (!nextQueueItem) {
      this.isProcessingQueue = false
      this.onQueueStateChanged?.(false)
      return
    }

    this.isProcessingQueue = true
    this.currentState = applyMove(this.currentState, nextQueueItem.move)
    this.renderCurrentState()
    this.onMoveApplied?.(this.currentState, nextQueueItem.move, nextQueueItem.countTowardsStats)
    nextQueueItem.onComplete?.()

    window.setTimeout(() => {
      this.processQueue()
    }, this.stepDelayMs)
  }

  private renderCurrentState(): void {
    const group = createCubeGroupFromState(this.currentState)
    this.sceneManager.setContent(group)
  }

  private getTurnTargets(): Mesh[] {
    const group = this.sceneManager.getContentGroup()
    if (!group) {
      return []
    }

    return group.children.filter((child): child is Mesh => child.type === 'Mesh')
  }

  public dispose(): void {
    this.interactionController.dispose()
    this.sceneManager.dispose()
  }
}
