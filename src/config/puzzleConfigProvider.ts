import { puzzleConfig, type PuzzlePreset, type PuzzleRuntimeConfig } from './puzzleConfig'

export interface PuzzleConfigProvider {
  getConfig(): PuzzleRuntimeConfig
}

export class StaticPuzzleConfigProvider implements PuzzleConfigProvider {
  public getConfig(): PuzzleRuntimeConfig {
    return puzzleConfig
  }
}

export function getDefaultPreset(config: PuzzleRuntimeConfig): PuzzlePreset {
  return config.presets.find((preset) => preset.dimension === config.defaultDimension) ?? config.presets[0]
}
