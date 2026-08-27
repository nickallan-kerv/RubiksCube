import { StaticPuzzleConfigProvider } from '../config/puzzleConfigProvider'
import { PuzzleShellRenderer } from '../ui/PuzzleShellRenderer'

export function bootstrapApp(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) {
    throw new Error('Application root element #app was not found.')
  }

  const renderer = new PuzzleShellRenderer(root, new StaticPuzzleConfigProvider())
  renderer.render()
}
