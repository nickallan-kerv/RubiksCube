import { StaticPuzzleConfigProvider } from '../config/puzzleConfigProvider'
import { getDefaultPreset } from '../config/puzzleConfigProvider'
import { isSolvedCubeState } from '../domain/cubeSolved'
import { PuzzleShellRenderer } from '../ui/PuzzleShellRenderer'
import { CubeViewportController } from '../render/cubeViewportController'
import { generateScrambleMoves } from '../utils/scramble'

const PERSISTED_SIZE_KEY = 'rubiksCube.selectedDimension'

export function bootstrapApp(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) {
    throw new Error('Application root element #app was not found.')
  }

  const configProvider = new StaticPuzzleConfigProvider()
  const config = configProvider.getConfig()

  const renderer = new PuzzleShellRenderer(root, configProvider)
  renderer.render()

  const canvasHost = root.querySelector<HTMLElement>('#cube-canvas')
  const sizeSelect = root.querySelector<HTMLSelectElement>('#cube-size')
  const turnSpeedInput = root.querySelector<HTMLInputElement>('#turn-speed')
  const scrambleButton = root.querySelector<HTMLButtonElement>('#scramble-cube')
  const resetCubeButton = root.querySelector<HTMLButtonElement>('#reset-cube')
  const movesStatus = root.querySelector<HTMLElement>('#moves-status')
  const timeStatus = root.querySelector<HTMLElement>('#time-status')
  const solveStatus = root.querySelector<HTMLElement>('#solve-status')

  if (
    !canvasHost ||
    !sizeSelect ||
    !turnSpeedInput ||
    !scrambleButton ||
    !resetCubeButton ||
    !movesStatus ||
    !timeStatus ||
    !solveStatus
  ) {
    throw new Error('Missing required UI elements for cube viewport initialization.')
  }

  const viewportController = new CubeViewportController(canvasHost)
  const initialDimension = restorePersistedDimension(sizeSelect)

  let moveCount = 0
  let elapsedSeconds = 0
  let hasActiveSolve = false
  let isScrambling = false
  let controlsLocked = false
  let lastKnownSolvedState = true
  let timerHandle: number | null = null

  const clearTimer = (): void => {
    if (timerHandle !== null) {
      window.clearInterval(timerHandle)
      timerHandle = null
    }
  }

  const renderStats = (): void => {
    movesStatus.textContent = `Moves: ${moveCount}`
    timeStatus.textContent = `Time: ${formatElapsedTime(elapsedSeconds)}`
  }

  const resetSession = (): void => {
    clearTimer()
    moveCount = 0
    elapsedSeconds = 0
    hasActiveSolve = false
    lastKnownSolvedState = true
    solveStatus.textContent = ''
    renderStats()
  }

  const applyTurnSpeedInput = (): void => {
    const value = Number(turnSpeedInput.value)
    viewportController.setStepDelay(value)
  }

  const setControlsLocked = (locked: boolean): void => {
    controlsLocked = locked
    sizeSelect.disabled = locked
    scrambleButton.disabled = locked
    resetCubeButton.disabled = locked
    turnSpeedInput.disabled = locked

    if (locked) {
      solveStatus.textContent = isScrambling ? 'Scrambling with queued turns...' : 'Turn animation in progress...'
    }
  }

  applyTurnSpeedInput()
  viewportController.setOnQueueStateChanged((isBusy) => {
    setControlsLocked(isBusy)
  })

  viewportController.setOnMoveApplied((state, _move, countTowardsStats) => {
    const solvedNow = isSolvedCubeState(state)

    if (countTowardsStats) {
      // Starting a new attempt from solved state should reset prior attempt stats.
      if (lastKnownSolvedState) {
        moveCount = 0
        elapsedSeconds = 0
      }

      moveCount += 1

      if (!hasActiveSolve) {
        hasActiveSolve = true
        clearTimer()
        timerHandle = window.setInterval(() => {
          elapsedSeconds += 1
          renderStats()
        }, 1000)
      }
    }

    renderStats()

    if (hasActiveSolve && !isScrambling && solvedNow) {
      hasActiveSolve = false
      clearTimer()
      solveStatus.textContent = `Solved in ${moveCount} moves at ${formatElapsedTime(elapsedSeconds)}.`
    }

    lastKnownSolvedState = solvedNow
  })

  resetSession()
  viewportController.renderSolvedCube(initialDimension)
  lastKnownSolvedState = true

  sizeSelect.addEventListener('change', () => {
    if (controlsLocked) {
      return
    }

    resetSession()
    const nextDimension = Number(sizeSelect.value)
    viewportController.renderSolvedCube(nextDimension)
    lastKnownSolvedState = true
    persistSelectedDimension(nextDimension)

    const matchingPreset = config.presets.find((preset) => preset.dimension === nextDimension)
    if (matchingPreset) {
      solveStatus.textContent = `Default scramble length: ${matchingPreset.scrambleLength}.`
    }
  })

  turnSpeedInput.addEventListener('input', applyTurnSpeedInput)
  turnSpeedInput.addEventListener('change', applyTurnSpeedInput)
  turnSpeedInput.addEventListener('blur', applyTurnSpeedInput)

  scrambleButton.addEventListener('click', () => {
    if (controlsLocked) {
      return
    }

    const dimension = Number(sizeSelect.value)
    const matchingPreset =
      config.presets.find((preset) => preset.dimension === dimension) ?? getDefaultPreset(config)

    resetSession()
    isScrambling = true
    solveStatus.textContent = `Scrambling with ${matchingPreset.scrambleLength} moves...`
    viewportController.renderSolvedCube(dimension)
    lastKnownSolvedState = true
    viewportController.playMoves(generateScrambleMoves(dimension, matchingPreset.scrambleLength), {
      countTowardsStats: false,
      onComplete: () => {
        isScrambling = false
        solveStatus.textContent = 'Scramble complete. Start solving!'
      },
    })
  })

  resetCubeButton.addEventListener('click', () => {
    if (controlsLocked) {
      return
    }

    resetSession()
    const nextDimension = Number(sizeSelect.value)
    viewportController.renderSolvedCube(nextDimension)
    lastKnownSolvedState = true
    solveStatus.textContent = 'Cube reset to solved state.'
  })
}

function restorePersistedDimension(sizeSelect: HTMLSelectElement): number {
  const persistedValue = window.localStorage.getItem(PERSISTED_SIZE_KEY)
  if (!persistedValue) {
    return Number(sizeSelect.value)
  }

  const hasMatchingOption = Array.from(sizeSelect.options).some((option) => option.value === persistedValue)
  if (!hasMatchingOption) {
    return Number(sizeSelect.value)
  }

  sizeSelect.value = persistedValue
  return Number(persistedValue)
}

function persistSelectedDimension(dimension: number): void {
  window.localStorage.setItem(PERSISTED_SIZE_KEY, String(dimension))
}

function formatElapsedTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
