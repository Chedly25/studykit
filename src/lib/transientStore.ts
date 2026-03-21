/** Persistent store for ephemeral data (quizzes, code playgrounds).
 *  Uses localStorage so data survives re-renders and page refreshes. */

const PREFIX = 'transient_'

export function setTransient<T>(id: string, data: T): void {
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(data))
  } catch {
    // localStorage full — silently fail
  }
}

export function getTransient<T>(id: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + id)
    if (!raw) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function clearTransient(id: string): void {
  localStorage.removeItem(PREFIX + id)
}
