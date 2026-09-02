import { StaticPuzzleConfigProvider } from '../config/puzzleConfigProvider'
import { getDefaultPreset } from '../config/puzzleConfigProvider'
import { invertMove, moveToNotation, type CubeMove } from '../domain/cubeNotation'
import { isSolvedCubeState } from '../domain/cubeSolved'
import { PuzzleShellRenderer } from '../ui/PuzzleShellRenderer'
import { CubeViewportController } from '../render/cubeViewportController'
import { generateScrambleMoves } from '../utils/scramble'
import type { InteractionDebugSnapshot } from '../render/faceTurnInteractionController'
import type { CubeState } from '../domain/cubeState'

const PERSISTED_SIZE_KEY = 'rubiksCube.selectedDimension'
interface MoveHistoryEntry {
  label: string
  state: CubeState
  move: CubeMove | null
  moveCount: number
  elapsedSeconds: number
  solved: boolean
}

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
  const scrambleButton = root.querySelector<HTMLButtonElement>('#scramble-cube')
  const resetCubeButton = root.querySelector<HTMLButtonElement>('#reset-cube')
  const moveHistoryPicker = root.querySelector<HTMLElement>('#move-history-picker')
  const moveHistoryList = root.querySelector<HTMLOListElement>('#move-history-list')
  const interactionDebug = root.querySelector<HTMLElement>('#interaction-debug')
  const statsStatus = root.querySelector<HTMLElement>('#stats-status')
  const solveStatus = root.querySelector<HTMLElement>('#solve-status')

  if (
    !canvasHost ||
    !sizeSelect ||
    !scrambleButton ||
    !resetCubeButton ||
    !moveHistoryPicker ||
    !moveHistoryList ||
    (config.interactionDebugEnabled && !interactionDebug) ||
    !statsStatus ||
    !solveStatus
  ) {
    throw new Error('Missing required UI elements for cube viewport initialization.')
  }

  const viewportController = new CubeViewportController(canvasHost)
  viewportController.setStepDelay(config.turnAnimationMs)
  const initialDimension = restorePersistedDimension(sizeSelect)

  let moveCount = 0
  let elapsedSeconds = 0
  let hasActiveSolve = false
  let isScrambling = false
  let controlsLocked = false
  let lastKnownSolvedState = true
  let timerHandle: number | null = null
  let historyEntries: MoveHistoryEntry[] = []
  let currentHistoryIndex = -1
  let historyTouchLastY: number | null = null
  let historyTouchLastTs: number | null = null
  let historyStepCarry = 0
  let historyMomentumVelocity = 0
  let historyMomentumFrame: number | null = null
  let lastNonCancelInteractionSnapshot: InteractionDebugSnapshot | null = null

  const renderInteractionDebug = (snapshot: InteractionDebugSnapshot): void => {
    if (snapshot.phase !== 'cancel') {
      lastNonCancelInteractionSnapshot = snapshot
    }

    const effectiveSnapshot =
      snapshot.phase === 'cancel' && lastNonCancelInteractionSnapshot
        ? lastNonCancelInteractionSnapshot
        : snapshot

    const dimension = Number(sizeSelect.value)
    const lines: string[] = [
      snapshot.phase === 'cancel' && effectiveSnapshot !== snapshot
        ? `phase: cancel (showing last ${effectiveSnapshot.phase})`
        : `phase: ${effectiveSnapshot.phase}`,
    ]
    lines.push(`dimension: ${dimension}`)
    lines.push('slice mode: projected tangent')

    const isMoveIntentPhase = effectiveSnapshot.phase === 'drag' || effectiveSnapshot.phase === 'up'
    if (isMoveIntentPhase) {
      const { face, direction, layer } = effectiveSnapshot
      if (face !== undefined && direction !== undefined && layer !== undefined) {
        const layerPrefix = layer > 0 ? `${layer + 1}` : ''
        const directionSuffix = direction === 'CCW' ? "'" : ''
        lines.push(`pending: ${layerPrefix}${face}${directionSuffix}`)
      }
    }

    if (effectiveSnapshot.face !== undefined) {
      lines.push(`face: ${effectiveSnapshot.face}`)
    }

    if (effectiveSnapshot.layer !== undefined) {
      lines.push(`layer: ${effectiveSnapshot.layer}`)
    }

    if (
      effectiveSnapshot.x !== undefined &&
      effectiveSnapshot.y !== undefined &&
      effectiveSnapshot.z !== undefined
    ) {
      lines.push(`cell: (${effectiveSnapshot.x}, ${effectiveSnapshot.y}, ${effectiveSnapshot.z})`)
    }

    if (effectiveSnapshot.deltaX !== undefined && effectiveSnapshot.deltaY !== undefined) {
      lines.push(`delta: (${Math.round(effectiveSnapshot.deltaX)}, ${Math.round(effectiveSnapshot.deltaY)})`)
    }

    if (effectiveSnapshot.direction !== undefined) {
      lines.push(`direction: ${effectiveSnapshot.direction}`)
    }

    if (effectiveSnapshot.tangentAxis !== undefined) {
      lines.push(`tangent axis: ${effectiveSnapshot.tangentAxis}`)
    }

    if (effectiveSnapshot.rotationAxis !== undefined) {
      lines.push(`rotation axis: ${effectiveSnapshot.rotationAxis}`)
    }

    if (effectiveSnapshot.rotationSign !== undefined) {
      lines.push(`rotation sign: ${effectiveSnapshot.rotationSign}`)
    }

    if (effectiveSnapshot.thresholdPx !== undefined) {
      lines.push(`threshold: ${effectiveSnapshot.thresholdPx}px`)
    }

    if (interactionDebug) {
      interactionDebug.textContent = lines.join('\n')
    }
  }

  const clearTimer = (): void => {
    if (timerHandle !== null) {
      window.clearInterval(timerHandle)
      timerHandle = null
    }
  }

  const renderStats = (): void => {
    statsStatus.textContent = `Moves: ${moveCount} Time: ${formatElapsedTime(elapsedSeconds)}`
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

  const renderMoveHistory = (scrollBehavior: ScrollBehavior = 'auto'): void => {
    moveHistoryList.innerHTML = ''

    if (historyEntries.length === 0) {
      const emptyRow = document.createElement('li')
      emptyRow.className = 'history-empty'
      emptyRow.textContent = 'No move history yet.'
      moveHistoryList.appendChild(emptyRow)
      return
    }

    historyEntries.forEach((entry, absoluteIndex) => {
      const listItem = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'history-item'
      button.textContent = `${absoluteIndex}. ${entry.label}`

      const isActive = absoluteIndex === currentHistoryIndex
      if (isActive) {
        button.classList.add('is-active')
        button.setAttribute('aria-current', 'step')
      }

      button.disabled = controlsLocked || isActive
      button.addEventListener('click', () => {
        restoreHistoryCheckpoint(absoluteIndex)
      })

      listItem.appendChild(button)
      moveHistoryList.appendChild(listItem)
    })

    const activeItem = moveHistoryList.querySelector<HTMLButtonElement>('button.history-item.is-active')
    if (activeItem) {
      const targetTop = activeItem.offsetTop - (moveHistoryPicker.clientHeight - activeItem.offsetHeight) / 2
      moveHistoryPicker.scrollTo({ top: Math.max(0, targetTop), behavior: scrollBehavior })
    }
  }

  const setHistoryBaseline = (label: string, state: CubeState): void => {
    historyEntries = [
      {
        label,
        state: cloneCubeState(state),
        move: null,
        moveCount,
        elapsedSeconds,
        solved: isSolvedCubeState(state),
      },
    ]
    currentHistoryIndex = 0
    renderMoveHistory()
  }

  const appendMoveHistoryEntry = (label: string, state: CubeState, move: CubeMove): void => {
    const truncatedHistory = historyEntries.slice(0, currentHistoryIndex + 1)
    truncatedHistory.push({
      label,
      state: cloneCubeState(state),
      move,
      moveCount,
      elapsedSeconds,
      solved: isSolvedCubeState(state),
    })

    historyEntries = truncatedHistory
    currentHistoryIndex = historyEntries.length - 1
    renderMoveHistory()
  }

  const startTimer = (): void => {
    clearTimer()
    timerHandle = window.setInterval(() => {
      elapsedSeconds += 1
      renderStats()
    }, 1000)
  }

  const restoreHistoryCheckpoint = (historyIndex: number): void => {
    if (controlsLocked) {
      return
    }

    const checkpoint = historyEntries[historyIndex]
    if (!checkpoint) {
      return
    }

    const historyMoves = getHistoryTransitionMoves(currentHistoryIndex, historyIndex)
    currentHistoryIndex = historyIndex
    moveCount = checkpoint.moveCount
    elapsedSeconds = checkpoint.elapsedSeconds
    lastKnownSolvedState = checkpoint.solved
    isScrambling = false

    hasActiveSolve = moveCount > 0 && !checkpoint.solved
    clearTimer()
    if (hasActiveSolve) {
      startTimer()
    }

    solveStatus.textContent = checkpoint.solved
      ? 'Restored to solved checkpoint.'
      : 'Restored to selected checkpoint.'

    renderStats()
    renderMoveHistory('smooth')

    if (historyMoves.length === 0) {
      viewportController.setState(checkpoint.state)
      return
    }

    viewportController.playMoves(historyMoves, {
      countTowardsStats: false,
      onComplete: () => viewportController.setState(checkpoint.state),
    })
  }

  const getHistoryTransitionMoves = (fromIndex: number, toIndex: number): CubeMove[] => {
    if (toIndex > fromIndex) {
      return historyEntries.slice(fromIndex + 1, toIndex + 1).flatMap((entry) => (entry.move ? [entry.move] : []))
    }

    return historyEntries
      .slice(toIndex + 1, fromIndex + 1)
      .reverse()
      .flatMap((entry) => (entry.move ? [invertMove(entry.move)] : []))
  }

  const moveHistorySelectionBySteps = (steps: number): void => {
    if (controlsLocked || historyEntries.length === 0 || steps === 0) {
      return
    }

    const targetIndex = Math.max(0, Math.min(historyEntries.length - 1, currentHistoryIndex + steps))
    if (targetIndex !== currentHistoryIndex) {
      restoreHistoryCheckpoint(targetIndex)
    }
  }

  const cancelHistoryMomentum = (): void => {
    if (historyMomentumFrame !== null) {
      window.cancelAnimationFrame(historyMomentumFrame)
      historyMomentumFrame = null
    }
  }

  const applyHistoryStepDelta = (stepDelta: number): void => {
    if (stepDelta === 0) {
      return
    }

    historyStepCarry += stepDelta
    let wholeSteps = 0
    if (historyStepCarry > 0) {
      wholeSteps = Math.floor(historyStepCarry)
    } else if (historyStepCarry < 0) {
      wholeSteps = Math.ceil(historyStepCarry)
    }

    if (wholeSteps === 0) {
      return
    }

    historyStepCarry -= wholeSteps
    const previousIndex = currentHistoryIndex
    moveHistorySelectionBySteps(wholeSteps)

    if (currentHistoryIndex === previousIndex) {
      historyStepCarry = 0
      historyMomentumVelocity *= 0.2
    }
  }

  const startHistoryMomentum = (initialVelocityStepsPerSecond: number): void => {
    historyMomentumVelocity = Math.max(-72, Math.min(72, initialVelocityStepsPerSecond))
    if (historyMomentumFrame !== null) {
      return
    }

    let lastTimestamp = performance.now()
    const tick = (timestamp: number): void => {
      const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05)
      lastTimestamp = timestamp

      historyMomentumVelocity *= Math.exp(-9 * deltaSeconds)
      applyHistoryStepDelta(historyMomentumVelocity * deltaSeconds)

      if (Math.abs(historyMomentumVelocity) < 0.08) {
        cancelHistoryMomentum()
        historyMomentumVelocity = 0
        historyStepCarry = 0
        return
      }

      historyMomentumFrame = window.requestAnimationFrame(tick)
    }

    historyMomentumFrame = window.requestAnimationFrame(tick)
  }

  moveHistoryPicker.addEventListener(
    'wheel',
    (event) => {
      if (historyEntries.length === 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      applyHistoryStepDelta(event.deltaY / 140)

      if (Math.abs(event.deltaY) > 180) {
        const boostedVelocity = historyMomentumVelocity + event.deltaY * 0.045
        startHistoryMomentum(boostedVelocity)
      }
    },
    { passive: false },
  )

  moveHistoryPicker.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches[0]
      if (!touch) {
        return
      }

      cancelHistoryMomentum()
      historyMomentumVelocity = 0
      historyStepCarry = 0
      historyTouchLastY = touch.clientY
      historyTouchLastTs = performance.now()
    },
    { passive: true },
  )

  moveHistoryPicker.addEventListener(
    'touchmove',
    (event) => {
      if (historyTouchLastY === null || historyTouchLastTs === null) {
        return
      }

      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const now = performance.now()
      const deltaY = touch.clientY - historyTouchLastY
      const deltaSeconds = Math.max((now - historyTouchLastTs) / 1000, 0.008)
      const stepDelta = -deltaY / 40

      if (Math.abs(stepDelta) < 0.2) {
        historyTouchLastY = touch.clientY
        historyTouchLastTs = now
        return
      }

      event.preventDefault()
      event.stopPropagation()

      applyHistoryStepDelta(stepDelta)
      historyMomentumVelocity = stepDelta / deltaSeconds
      historyTouchLastY = touch.clientY
      historyTouchLastTs = now
    },
    { passive: false },
  )

  moveHistoryPicker.addEventListener('touchend', () => {
    historyTouchLastY = null
    historyTouchLastTs = null

    if (Math.abs(historyMomentumVelocity) > 0.55) {
      startHistoryMomentum(historyMomentumVelocity)
    } else {
      historyMomentumVelocity = 0
      historyStepCarry = 0
    }
  })

  moveHistoryPicker.addEventListener('touchcancel', () => {
    historyTouchLastY = null
    historyTouchLastTs = null
    historyMomentumVelocity = 0
    historyStepCarry = 0
    cancelHistoryMomentum()
  })

  const setControlsLocked = (locked: boolean): void => {
    controlsLocked = locked
    sizeSelect.disabled = locked
    scrambleButton.disabled = locked
    resetCubeButton.disabled = locked

    if (locked) {
      cancelHistoryMomentum()
      historyMomentumVelocity = 0
      historyStepCarry = 0
      solveStatus.textContent = isScrambling ? 'Scrambling with queued turns...' : ''
    }

    renderMoveHistory()
  }

  viewportController.setOnQueueStateChanged((isBusy) => {
    setControlsLocked(isBusy)
  })

  if (config.interactionDebugEnabled) {
    viewportController.setOnInteractionDebug(renderInteractionDebug)
  }

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
        startTimer()
      }

      appendMoveHistoryEntry(moveToNotation(_move), state, _move)
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
  setHistoryBaseline('Start', viewportController.getCurrentState())

  sizeSelect.addEventListener('change', () => {
    if (controlsLocked) {
      return
    }

    resetSession()
    const nextDimension = Number(sizeSelect.value)
    viewportController.renderSolvedCube(nextDimension)
    lastKnownSolvedState = true
    setHistoryBaseline('Start', viewportController.getCurrentState())
    persistSelectedDimension(nextDimension)

    const matchingPreset = config.presets.find((preset) => preset.dimension === nextDimension)
    if (matchingPreset) {
      solveStatus.textContent = `Default scramble length: ${matchingPreset.scrambleLength}.`
    }
  })

  scrambleButton.addEventListener('click', () => {
    if (controlsLocked) {
      return
    }

    const dimension = Number(sizeSelect.value)
    const matchingPreset =
      config.presets.find((preset) => preset.dimension === dimension) ?? getDefaultPreset(config)

    resetSession()
    isScrambling = true
    historyEntries = []
    currentHistoryIndex = -1
    renderMoveHistory()
    solveStatus.textContent = `Scrambling with ${matchingPreset.scrambleLength} moves...`
    viewportController.renderSolvedCube(dimension)
    lastKnownSolvedState = true
    viewportController.playMoves(generateScrambleMoves(dimension, matchingPreset.scrambleLength), {
      countTowardsStats: false,
      onComplete: () => {
        isScrambling = false
        setHistoryBaseline('Scrambled', viewportController.getCurrentState())
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
    setHistoryBaseline('Start', viewportController.getCurrentState())
    solveStatus.textContent = 'Cube reset to solved state.'
  })
}

function cloneCubeState(state: CubeState): CubeState {
  return {
    dimension: state.dimension,
    faces: {
      U: state.faces.U.map((row) => [...row]),
      D: state.faces.D.map((row) => [...row]),
      L: state.faces.L.map((row) => [...row]),
      R: state.faces.R.map((row) => [...row]),
      F: state.faces.F.map((row) => [...row]),
      B: state.faces.B.map((row) => [...row]),
    },
  }
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
