import { useEffect, useId, useRef } from 'react'
import { isTypingTarget, matchesKeySet, parseCombo } from './parseCombo'
import { useKeyboardShortcutsRegistry } from './KeyboardShortcutsContext'

export interface ShortcutOptions {
  label: string
  scope?: string
  enabled?: boolean
  preventDefault?: boolean
  allowInInput?: boolean
}

const SEQUENCE_TIMEOUT_MS = 800

export function useKeyboardShortcut(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: ShortcutOptions,
) {
  const { register, unregister } = useKeyboardShortcutsRegistry()
  const id = useId()
  const handlerRef = useRef(handler)
  // useLatestRef pattern — keep handlerRef in sync without re-binding listeners
  useEffect(() => {
    handlerRef.current = handler
  })

  const enabled = options.enabled ?? true
  const scope = options.scope ?? 'global'
  const preventDefault = options.preventDefault ?? true
  const allowInInput = options.allowInInput ?? false

  useEffect(() => {
    const parsed = parseCombo(combo)
    register({
      id,
      combo,
      display: parsed.display,
      label: options.label,
      scope,
      enabled,
    })
    return () => unregister(id)
  }, [id, combo, options.label, scope, enabled, register, unregister])

  useEffect(() => {
    if (!enabled) return

    const parsed = parseCombo(combo)

    if (parsed.type === 'single') {
      const keySet = parsed.keys[0]
      const onKey = (e: KeyboardEvent) => {
        if (!allowInInput && isTypingTarget(e.target)) return
        if (matchesKeySet(e, keySet)) {
          if (preventDefault) e.preventDefault()
          handlerRef.current(e)
        }
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }

    // Sequence
    const expected = parsed.keys.map((k) => k[0])
    let buffer: string[] = []
    let timeout: ReturnType<typeof setTimeout> | null = null

    const reset = () => {
      buffer = []
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (!allowInInput && isTypingTarget(e.target)) return
      // Ignore standalone modifier presses
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return
      // Sequence shortcuts ignore modified key presses (e.g. cmd+g shouldn't enter "g d" buffer)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        reset()
        return
      }

      const key = e.key.toLowerCase()
      const idx = buffer.length
      if (key !== expected[idx]) {
        reset()
        // Try starting a fresh buffer with this key if it matches expected[0]
        if (key === expected[0]) {
          buffer = [key]
          timeout = setTimeout(reset, SEQUENCE_TIMEOUT_MS)
        }
        return
      }

      buffer.push(key)
      if (timeout) clearTimeout(timeout)

      if (buffer.length === expected.length) {
        if (preventDefault) e.preventDefault()
        handlerRef.current(e)
        reset()
      } else {
        timeout = setTimeout(reset, SEQUENCE_TIMEOUT_MS)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (timeout) clearTimeout(timeout)
    }
  }, [combo, enabled, allowInInput, preventDefault])
}
