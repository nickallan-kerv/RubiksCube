export type CubeDimension = 2 | 3 | 4

export interface PuzzlePreset {
  dimension: CubeDimension
  label: string
  scrambleLength: number
}

export interface PuzzleRuntimeConfig {
  defaultDimension: CubeDimension
  turnAnimationMs: number
  interactionDebugEnabled: boolean
  presets: PuzzlePreset[]
}

export const puzzleConfig: PuzzleRuntimeConfig = {
  defaultDimension: 3,
  turnAnimationMs: 220,
  interactionDebugEnabled: false,
  presets: [
    { dimension: 2, label: '2x2 Pocket', scrambleLength: 12 },
    { dimension: 3, label: '3x3 Classic', scrambleLength: 20 },
    { dimension: 4, label: '4x4 Revenge', scrambleLength: 32 },
  ],
}
