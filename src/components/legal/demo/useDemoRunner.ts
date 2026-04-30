/**
 * Demo runner — walks a script of `DemoStep`s sequentially, mutating state
 * over time. Pause / resume / skip-to-end / restart are all supported.
 *
 * Each coach demo defines its own state shape and field type, then passes
 * an `applyType` callback that knows how to append a character to a given
 * field of that state. Custom step kinds (e.g. axis-reveal animations) are
 * routed through the optional `applyCustomStep` extension hook.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type {
  DemoControls,
  GenericDemoStep,
  NarrateStep,
  SetStateStep,
  TypeStep,
  WaitStep,
} from './types'

interface UseDemoRunnerOptions<TState, TField extends string, TStep> {
  /** State at start of demo (and after restart). */
  initialState: TState
  /** Final state after skip-to-end. */
  finalState: TState
  /** Sequence of steps to execute. */
  steps: TStep[]
  /** Approximate total duration in ms — used by the player's progress bar. */
  estimatedDurationMs: number
  /** Coach-specific: append a single char to a field of state. */
  applyType: (state: TState, field: TField, char: string) => TState
  /**
   * Coach-specific extension: handle non-generic step kinds.
   * Receives the current step and a `tick` helper for paced animations.
   * Should call `setState` to mutate state and `await tick(ms)` to advance.
   * Should return when the step is complete.
   */
  applyCustomStep?: (
    step: TStep,
    helpers: {
      getState: () => TState
      setState: (updater: (s: TState) => TState) => void
      tick: (ms: number) => Promise<void>
      cancelled: () => boolean
    },
  ) => Promise<void>
  /** If true, playback starts immediately on mount. Default: true. */
  autoplay?: boolean
}

interface DemoRunnerResult<TState> {
  state: TState
  caption: string
  controls: DemoControls
}

export function useDemoRunner<TState, TField extends string, TStep extends GenericDemoStep<TState, TField>>(
  opts: UseDemoRunnerOptions<TState, TField, TStep>,
): DemoRunnerResult<TState> {
  const [state, setStateInternal] = useState<TState>(opts.initialState)
  const [caption, setCaption] = useState<string>('')
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [status, setStatus] = useState<DemoControls['status']>(opts.autoplay === false ? 'idle' : 'playing')
  const [elapsedMs, setElapsedMs] = useState<number>(0)

  // Refs for the async loop to read without re-running on every state tick.
  const stateRef = useRef<TState>(opts.initialState)
  const pausedRef = useRef<boolean>(false)
  const cancelledRef = useRef<boolean>(false)
  const finishedRef = useRef<boolean>(false)
  const restartTokenRef = useRef<number>(0) // bumps on restart to cancel stale loops

  // Keep stateRef in sync with state. Also propagate via setStateInternal.
  const setState = useCallback((updater: (s: TState) => TState) => {
    stateRef.current = updater(stateRef.current)
    setStateInternal(stateRef.current)
  }, [])

  // ── Tick helper — sleeps `ms` real-time, but freezes the clock while paused.
  // Chunks the wait into 50ms slices so pause/cancel feel responsive.
  const tick = useCallback((ms: number) => {
    return new Promise<void>(resolve => {
      let remaining = ms
      const startedAt = Date.now()
      const sliceMs = 50
      const loop = () => {
        if (cancelledRef.current) return resolve()
        if (pausedRef.current) {
          setTimeout(loop, sliceMs)
          return
        }
        const slice = Math.min(remaining, sliceMs)
        setTimeout(() => {
          if (cancelledRef.current) return resolve()
          if (!pausedRef.current) {
            remaining -= slice
            setElapsedMs(prev => prev + slice)
          }
          if (remaining <= 0) resolve()
          else loop()
        }, slice)
      }
      // Avoid unused-startedAt warning; keep it for potential drift correction.
      void startedAt
      loop()
    })
  }, [])

  // ── Run a single generic step.
  const runGenericStep = useCallback(
    async (step: GenericDemoStep<TState, TField>) => {
      switch (step.kind) {
        case 'narrate': {
          const s = step as NarrateStep
          setCaption(s.text)
          await tick(s.ms)
          // Don't auto-clear — next narrate replaces it. Empty narrate clears.
          if (s.text === '') setCaption('')
          break
        }
        case 'wait': {
          const s = step as WaitStep
          await tick(s.ms)
          break
        }
        case 'set': {
          const s = step as SetStateStep<TState>
          setState(prev => s.update(prev))
          if (s.dwellMs && s.dwellMs > 0) await tick(s.dwellMs)
          break
        }
        case 'type': {
          const s = step as TypeStep<TField>
          const tickMs = Math.max(1, Math.round(1000 / s.charsPerSec))
          for (let i = 0; i < s.text.length; i++) {
            if (cancelledRef.current) return
            const char = s.text[i]
            setState(prev => opts.applyType(prev, s.field, char))
            await tick(tickMs)
          }
          break
        }
      }
    },
    [tick, setState, opts],
  )

  // ── Main loop — runs once per mount or restart.
  useEffect(() => {
    cancelledRef.current = false
    finishedRef.current = false
    const myToken = restartTokenRef.current

    if (status === 'idle') return

    let aborted = false

    ;(async () => {
      for (let i = 0; i < opts.steps.length; i++) {
        if (cancelledRef.current || aborted || myToken !== restartTokenRef.current) return
        setStepIndex(i)
        const step = opts.steps[i]
        const isGeneric =
          step.kind === 'narrate' ||
          step.kind === 'wait' ||
          step.kind === 'set' ||
          step.kind === 'type'
        if (isGeneric) {
          await runGenericStep(step as GenericDemoStep<TState, TField>)
        } else if (opts.applyCustomStep) {
          await opts.applyCustomStep(step, {
            getState: () => stateRef.current,
            setState,
            tick,
            cancelled: () => cancelledRef.current,
          })
        }
        if (cancelledRef.current || aborted || myToken !== restartTokenRef.current) return
      }
      if (!cancelledRef.current && !aborted && myToken === restartTokenRef.current) {
        finishedRef.current = true
        setStatus('finished')
      }
    })()

    return () => {
      aborted = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'playing' ? 'on' : 'off', restartTokenRef.current])

  // ── Public controls.
  const pause = useCallback(() => {
    if (status !== 'playing') return
    pausedRef.current = true
    setStatus('paused')
  }, [status])

  const resume = useCallback(() => {
    if (status !== 'paused') return
    pausedRef.current = false
    setStatus('playing')
  }, [status])

  const skipToEnd = useCallback(() => {
    cancelledRef.current = true
    setState(() => opts.finalState)
    setCaption('')
    setStepIndex(opts.steps.length)
    setElapsedMs(opts.estimatedDurationMs)
    finishedRef.current = true
    setStatus('finished')
  }, [opts.finalState, opts.steps.length, opts.estimatedDurationMs, setState])

  const restart = useCallback(() => {
    cancelledRef.current = true
    pausedRef.current = false
    setState(() => opts.initialState)
    setCaption('')
    setStepIndex(0)
    setElapsedMs(0)
    finishedRef.current = false
    restartTokenRef.current += 1
    setStatus('playing')
  }, [opts.initialState, setState])

  const controls: DemoControls = {
    status,
    elapsedMs,
    totalMs: opts.estimatedDurationMs,
    stepIndex,
    stepCount: opts.steps.length,
    pause,
    resume,
    skipToEnd,
    restart,
  }

  return { state, caption, controls }
}
