/**
 * Generic types for feature demos.
 * Each coach demo defines its own state shape; the step kinds below are shared.
 */

/**
 * Generic demo steps. Coach-specific demos can extend this union with their own
 * step kinds (e.g. "reveal-axes" for grading animations).
 */
export type GenericDemoStep<TState, TField extends string = string> =
  | NarrateStep
  | WaitStep
  | SetStateStep<TState>
  | TypeStep<TField>

export interface NarrateStep {
  kind: 'narrate'
  /** Caption shown in the demo footer. Empty string clears it. */
  text: string
  /** How long the caption stays (ms). The runner advances after this. */
  ms: number
}

export interface WaitStep {
  kind: 'wait'
  ms: number
}

export interface SetStateStep<TState> {
  kind: 'set'
  update: (s: TState) => TState
  /** Optional dwell time after applying the patch before the next step. */
  dwellMs?: number
}

export interface TypeStep<TField extends string = string> {
  kind: 'type'
  /** Field identifier — coach-specific. The coach demo body wires this to a real field. */
  field: TField
  /** Text to type. Newlines preserved. */
  text: string
  /** Typing speed in characters per second (e.g. 50 = ~12 wpm). */
  charsPerSec: number
}

/**
 * Public interface exposed by the demo runner — used by the player UI to
 * render progress, pause/skip controls, and (eventually) speed selection.
 */
export interface DemoControls {
  /** Whether playback is in progress (vs paused / finished). */
  status: 'idle' | 'playing' | 'paused' | 'finished'
  /** Elapsed playback time in ms (real wall time, accumulated across pauses). */
  elapsedMs: number
  /** Total estimated duration from the script's `estimatedDurationMs` (ms). */
  totalMs: number
  /** Index of the step currently executing. */
  stepIndex: number
  /** Total step count. */
  stepCount: number
  pause: () => void
  resume: () => void
  /** Skip to the end of the script (jumps state to final). */
  skipToEnd: () => void
  /** Restart from the beginning. */
  restart: () => void
}
