const MOD_KEYS = ['meta', 'ctrl', 'alt', 'shift'] as const
type ModKey = (typeof MOD_KEYS)[number]

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

export interface ParsedCombo {
  type: 'single' | 'sequence'
  keys: string[][]
  display: string
}

function isMod(key: string): key is ModKey {
  return (MOD_KEYS as readonly string[]).includes(key)
}

function normalizeKey(key: string): string {
  const k = key.toLowerCase().trim()
  if (k === 'cmd' || k === 'mod') return isMac ? 'meta' : 'ctrl'
  if (k === 'control') return 'ctrl'
  if (k === 'opt' || k === 'option') return 'alt'
  if (k === 'esc' || k === 'escape') return 'escape'
  if (k === 'space' || k === 'spacebar') return ' '
  if (k === 'return') return 'enter'
  if (k === 'plus') return '+'
  return k
}

function displayKey(key: string): string {
  const k = key.toLowerCase()
  if (k === 'meta') return isMac ? '⌘' : 'Win'
  if (k === 'ctrl') return isMac ? '⌃' : 'Ctrl'
  if (k === 'alt') return isMac ? '⌥' : 'Alt'
  if (k === 'shift') return isMac ? '⇧' : 'Shift'
  if (k === 'escape') return 'Esc'
  if (k === 'enter') return '↵'
  if (k === ' ') return 'Space'
  return k.toUpperCase()
}

export function parseCombo(combo: string): ParsedCombo {
  // Sequence: tokens separated by spaces, none containing '+'
  const tokens = combo.split(/\s+/).filter(Boolean)
  const isSequence = tokens.length > 1 && tokens.every((t) => !t.includes('+'))

  if (isSequence) {
    const keys = tokens.map((t) => [normalizeKey(t)])
    const display = tokens.map((t) => displayKey(normalizeKey(t))).join(' ')
    return { type: 'sequence', keys, display }
  }

  const parts = combo.split('+').map(normalizeKey)
  // Sort modifiers consistently for display: meta, ctrl, alt, shift, key
  const mods = parts.filter(isMod)
  const nonMods = parts.filter((p) => !isMod(p))
  const orderedMods = MOD_KEYS.filter((m) => mods.includes(m))
  const display = [...orderedMods, ...nonMods].map(displayKey).join(' + ')
  return { type: 'single', keys: [parts], display }
}

export function matchesKeySet(event: KeyboardEvent, keySet: string[]): boolean {
  const wantedMods = new Set(keySet.filter(isMod))
  const eventMods: Record<ModKey, boolean> = {
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  }
  for (const mod of MOD_KEYS) {
    if (wantedMods.has(mod) !== eventMods[mod]) return false
  }
  const wantedKey = keySet.find((k) => !isMod(k))
  if (wantedKey === undefined) return true
  return event.key.toLowerCase() === wantedKey
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}
