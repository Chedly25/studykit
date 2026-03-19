/** Simple in-memory store for ephemeral data (e.g., quiz questions). Not persisted. */
const store = new Map<string, unknown>()

export function setTransient<T>(id: string, data: T): void {
  store.set(id, data)
}

export function getTransient<T>(id: string): T | undefined {
  return store.get(id) as T | undefined
}

export function clearTransient(id: string): void {
  store.delete(id)
}
