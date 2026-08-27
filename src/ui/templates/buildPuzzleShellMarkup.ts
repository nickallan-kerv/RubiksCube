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

  return `
  <main class="app-shell">
    <header class="top-bar">
      <div>
        <p class="kicker">Sprint 1 Foundation</p>
        <h1>Rubik's Cube Lab</h1>
      </div>
      <div class="status-strip" role="status" aria-live="polite" aria-atomic="true">
        <span id="moves-status">Moves: 0</span>
        <span id="time-status">Time: 00:00</span>
      </div>
    </header>

    <section class="workspace" aria-label="Puzzle workspace">
      <aside class="control-panel" aria-label="Puzzle controls">
        <fieldset class="controls-fieldset">
        <legend>Puzzle controls</legend>
        <label for="cube-size">Cube Size</label>
        <select id="cube-size" name="cube-size">
          ${optionsMarkup}
        </select>

        <label for="turn-speed">Turn Animation (ms)</label>
        <input id="turn-speed" name="turn-speed" type="number" min="100" max="500" step="10" value="${config.turnAnimationMs}" aria-describedby="turn-speed-hint" />

        <button id="scramble-cube" type="button">Scramble</button>
        <button id="reset-cube" type="button" class="ghost">Reset</button>
        </fieldset>

        <p class="hint">Default scramble for ${defaultPreset.label}: ${defaultPreset.scrambleLength} moves.</p>
        <p id="turn-speed-hint" class="hint">Speed applies to queued turns and manual face drags.</p>
        <p class="hint">Left-drag on a cube face to turn. Right-drag to orbit camera. Mouse wheel to zoom.</p>
        <p id="solve-status" class="hint" role="status" aria-live="polite"></p>
      </aside>

      <section class="scene-card" aria-label="3D puzzle viewport">
        <div id="cube-canvas" class="canvas-placeholder" tabindex="0" aria-label="Interactive Rubik's cube viewport"></div>
      </section>
    </section>
  </main>
`
}
