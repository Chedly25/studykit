/**
 * Generic localStorage helpers and time formatting utilities
 * used across all timer/tracking tools.
 */

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      return JSON.parse(raw) as T
    }
  } catch {
    // corrupt or missing — fall through
  }
  return fallback
}

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // storage full or unavailable — silently ignore
  }
}

/**
 * Format seconds as "MM:SS" (zero-padded).
 * For values >= 1 hour the minutes portion keeps counting (e.g. 65:12).
 */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * Format seconds as a human-readable string: "Xh Ym Zs".
 * Omits leading zero segments (e.g. "5m 30s" instead of "0h 5m 30s").
 */
export function formatTimeHMS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60

  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0 || h > 0) parts.push(`${m}m`)
  parts.push(`${sec}s`)

  return parts.join(' ')
}
