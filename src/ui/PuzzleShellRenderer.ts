import type { PuzzleConfigProvider } from '../config/puzzleConfigProvider'
import { buildPuzzleShellMarkup } from './templates/buildPuzzleShellMarkup'

export class PuzzleShellRenderer {
  private readonly root: HTMLElement
  private readonly configProvider: PuzzleConfigProvider

  public constructor(root: HTMLElement, configProvider: PuzzleConfigProvider) {
    this.root = root
    this.configProvider = configProvider
  }

  public render(): void {
    const config = this.configProvider.getConfig()
    this.root.innerHTML = buildPuzzleShellMarkup(config)
  }
}
