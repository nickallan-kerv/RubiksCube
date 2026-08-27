import { createSolvedCubeState } from '../domain/cubeState'
import { applyMove } from '../domain/cubeMoveEngine'
import { createMove, type CubeMove } from '../domain/cubeNotation'
import { createCubeGroupFromState } from './cubieMeshFactory'
import { ThreeSceneManager } from './threeSceneManager'

export class CubeViewportController {
  private readonly sceneManager: ThreeSceneManager
  private currentState = createSolvedCubeState(3)
  private readonly moveQueue: CubeMove[] = []
  private isProcessingQueue = false
  private stepDelayMs = 240

  public constructor(container: HTMLElement) {
    this.sceneManager = new ThreeSceneManager(container)
  }

  public renderSolvedCube(dimension: number): void {
    this.currentState = createSolvedCubeState(dimension)
    this.moveQueue.length = 0
    this.isProcessingQueue = false
    this.renderCurrentState()
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

    this.enqueueMoves(sequence)
  }

  private enqueueMoves(moves: CubeMove[]): void {
    this.moveQueue.push(...moves)

    if (!this.isProcessingQueue) {
      this.processQueue()
    }
  }

  private processQueue(): void {
    const nextMove = this.moveQueue.shift()
    if (!nextMove) {
      this.isProcessingQueue = false
      return
    }

    this.isProcessingQueue = true
    this.currentState = applyMove(this.currentState, nextMove)
    this.renderCurrentState()

    window.setTimeout(() => {
      this.processQueue()
    }, this.stepDelayMs)
  }

  private renderCurrentState(): void {
    const group = createCubeGroupFromState(this.currentState)
    this.sceneManager.setContent(group)
  }

  public dispose(): void {
    this.sceneManager.dispose()
  }
}
