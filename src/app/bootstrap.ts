import { StaticPuzzleConfigProvider } from '../config/puzzleConfigProvider'
import { PuzzleShellRenderer } from '../ui/PuzzleShellRenderer'
import { CubeViewportController } from '../render/cubeViewportController'

export function bootstrapApp(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) {
    throw new Error('Application root element #app was not found.')
  }

  const renderer = new PuzzleShellRenderer(root, new StaticPuzzleConfigProvider())
  renderer.render()

  const canvasHost = root.querySelector<HTMLElement>('#cube-canvas')
  const sizeSelect = root.querySelector<HTMLSelectElement>('#cube-size')
  const turnSpeedInput = root.querySelector<HTMLInputElement>('#turn-speed')
  const demoTurnsButton = root.querySelector<HTMLButtonElement>('#demo-turns')
  const resetCubeButton = root.querySelector<HTMLButtonElement>('#reset-cube')
  if (!canvasHost || !sizeSelect || !turnSpeedInput || !demoTurnsButton || !resetCubeButton) {
    throw new Error('Missing required UI elements for cube viewport initialization.')
  }

  const viewportController = new CubeViewportController(canvasHost)
  const initialDimension = Number(sizeSelect.value)
  viewportController.setStepDelay(Number(turnSpeedInput.value))
  viewportController.renderSolvedCube(initialDimension)
  viewportController.playDemoSequence()

  sizeSelect.addEventListener('change', () => {
    const nextDimension = Number(sizeSelect.value)
    viewportController.renderSolvedCube(nextDimension)
  })

  turnSpeedInput.addEventListener('change', () => {
    viewportController.setStepDelay(Number(turnSpeedInput.value))
  })

  demoTurnsButton.addEventListener('click', () => {
    viewportController.playDemoSequence()
  })

  resetCubeButton.addEventListener('click', () => {
    const nextDimension = Number(sizeSelect.value)
    viewportController.renderSolvedCube(nextDimension)
  })
}
