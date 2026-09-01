import type { PuzzleRuntimeConfig } from '../../config/puzzleConfig'
import { getDefaultPreset } from '../../config/puzzleConfigProvider'

export function buildPuzzleShellMarkup(config: PuzzleRuntimeConfig): string {
  const defaultPreset = getDefaultPreset(config)
  const optionsMarkup = config.presets
    .map((preset) => {
      const selected = preset.dimension === defaultPreset.dimension ? ' selected' : ''
      return `<option value="${preset.dimension}"${selected}>${preset.label}</option>`
    })
    .join('')
  const debugMarkup = config.interactionDebugEnabled
    ? `
        <section class="debug-panel" aria-label="Interaction debug">
          <h2 class="history-heading">Debug</h2>
          <pre id="interaction-debug" class="debug-output">Waiting for input...</pre>
        </section>`
    : ''

  return `
  <main class="app-shell">
    <header class="top-bar">
      <div class="title-controls">
        <h1><span>Rubiks</span><span class="title-suffix"> Cube</span></h1>
        <select id="cube-size" name="cube-size" aria-label="Cube size">
          ${optionsMarkup}
        </select>
      </div>
    </header>

    <section class="workspace" aria-label="Puzzle workspace">
      <aside class="control-panel" aria-label="Puzzle controls">
        <div class="button-row">
          <button id="scramble-cube" type="button">Scramble</button>
          <button id="reset-cube" type="button" class="ghost">Reset</button>
        </div>

        <section class="history-panel" aria-label="Move history diagnostics">
          <div class="history-header-row">
            <div id="stats-status" class="status-strip" role="status" aria-live="polite" aria-atomic="true">Moves: 0 Time: 00:00</div>
          </div>
          <div id="move-history-picker" class="history-picker-wrap" role="group" aria-label="History picker">
            <div class="history-picker-focus-overlay" aria-hidden="true"></div>
            <ol id="move-history-list" class="history-list history-picker" aria-live="polite"></ol>
          </div>
        </section>

        ${debugMarkup}

        <p id="solve-status" class="hint" role="status" aria-live="polite"></p>
      </aside>

      <section class="scene-card" aria-label="3D puzzle viewport">
        <div id="cube-canvas" class="canvas-placeholder" tabindex="0" aria-label="Interactive Rubik's cube viewport"></div>
      </section>
    </section>
  </main>
`
}
