/**
 * Session-scoped AI response cache using sessionStorage.
 * Auto-clears on tab close. Prevents duplicate AI calls for identical inputs.
 */

const PREFIX = 'ai_cache_'

function hashKey(parts: string[]): string {
  let hash = 5381
  const str = parts.join('|')
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash | 0
  }
  return PREFIX + Math.abs(hash).toString(36)
}

export function getCachedResponse(parts: string[]): string | null {
  try {
    return sessionStorage.getItem(hashKey(parts))
  } catch { return null }
}

export function setCachedResponse(parts: string[], response: string): void {
  try {
    sessionStorage.setItem(hashKey(parts), response)
  } catch { /* sessionStorage full — silently fail */ }
}
