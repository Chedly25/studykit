/**
 * Streaming JSON extractor — a state machine that feeds on streaming tokens
 * and emits complete JSON objects as they close within a target array.
 *
 * Usage:
 *   const ext = createStreamExtractor<Subject>('subjects', {
 *     onItem: (subject, i) => dispatch({ type: 'APPEND_SUBJECT', subject })
 *   })
 *   await streamChat({ ..., onToken: ext.feed })
 *   const allItems = ext.finalize()
 */

export interface StreamExtractorCallbacks<T> {
  onItem: (item: T, index: number) => void
  onError?: (error: Error) => void
}

export function createStreamExtractor<T>(
  arrayKey: string,
  callbacks: StreamExtractorCallbacks<T>,
) {
  let buffer = ''
  let items: T[] = []

  function cleanBuffer(): string {
    return buffer.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  }

  function extractItems() {
    const clean = cleanBuffer()

    // Find the array start: "arrayKey": [
    const pattern = new RegExp(`"${arrayKey}"\\s*:\\s*\\[`)
    const match = pattern.exec(clean)
    if (!match || match.index === undefined) return

    const arrayStart = match.index + match[0].length

    // Scan for complete objects within the array
    let i = arrayStart
    let depth = 0
    let inString = false
    let escape = false
    let objectStart = -1
    const foundItems: T[] = []

    while (i < clean.length) {
      const ch = clean[i]

      if (escape) {
        escape = false
        i++
        continue
      }

      if (ch === '\\' && inString) {
        escape = true
        i++
        continue
      }

      if (ch === '"') {
        inString = !inString
        i++
        continue
      }

      if (inString) {
        i++
        continue
      }

      if (ch === '{') {
        if (depth === 0) objectStart = i
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0 && objectStart >= 0) {
          const objectStr = clean.slice(objectStart, i + 1)
          try {
            foundItems.push(JSON.parse(objectStr) as T)
          } catch {
            // Partial or invalid JSON — skip
          }
          objectStart = -1
        }
      } else if (ch === ']' && depth === 0) {
        break
      }

      i++
    }

    // Emit only newly discovered items
    for (let j = items.length; j < foundItems.length; j++) {
      callbacks.onItem(foundItems[j], j)
    }
    items = foundItems
  }

  function feed(token: string) {
    buffer += token
    extractItems()
  }

  function finalize(): T[] {
    extractItems()

    if (items.length > 0) return items

    // Fallback: parse entire buffer as one JSON object
    const clean = cleanBuffer()
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return items

    try {
      const parsed = JSON.parse(jsonMatch[0])
      const arr = parsed[arrayKey]
      if (Array.isArray(arr)) {
        for (let i = items.length; i < arr.length; i++) {
          callbacks.onItem(arr[i] as T, i)
        }
        items = arr as T[]
      }
    } catch {
      // Can't parse
    }

    return items
  }

  function getItems(): T[] {
    return items
  }

  return { feed, finalize, getItems }
}
