/**
 * Global request gate — controls concurrency and rate for outbound API calls.
 * Prevents 429 thundering herd when multiple jobs/features hit the LLM simultaneously.
 *
 * Two separate gates: one for LLM (/api/chat), one for embeddings (/api/embed).
 * Each gate enforces:
 *   - Max N concurrent in-flight requests
 *   - Minimum gap between starting new requests
 *   - Automatic retry with exponential backoff on 429
 */

type QueueEntry = {
  resolve: () => void
}

class RequestGate {
  private active = 0
  private queue: QueueEntry[] = []
  private lastRequestTime = 0

  constructor(
    private readonly maxConcurrent: number,
    private readonly minGapMs: number,
  ) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++
      // Enforce minimum gap between requests
      const now = Date.now()
      const elapsed = now - this.lastRequestTime
      if (elapsed < this.minGapMs) {
        await new Promise(r => setTimeout(r, this.minGapMs - elapsed))
      }
      this.lastRequestTime = Date.now()
      return
    }

    // Queue and wait
    return new Promise<void>(resolve => {
      this.queue.push({ resolve })
    })
  }

  release(): void {
    this.active--
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      this.active++
      // Enforce gap before releasing next
      const now = Date.now()
      const elapsed = now - this.lastRequestTime
      if (elapsed < this.minGapMs) {
        setTimeout(() => {
          this.lastRequestTime = Date.now()
          next.resolve()
        }, this.minGapMs - elapsed)
      } else {
        this.lastRequestTime = Date.now()
        next.resolve()
      }
    }
  }
}

// LLM gate: max 3 concurrent, 300ms minimum gap between requests
export const llmGate = new RequestGate(3, 300)

// Embedding gate: max 2 concurrent, 200ms minimum gap
export const embedGate = new RequestGate(2, 200)

/**
 * Parse "retry after N seconds" from an error message.
 * Returns delay in ms, or null if not found.
 */
export function parseRetryAfter(error: string): number | null {
  const match = error.match(/after (\d+) second/)
  if (match) return parseInt(match[1], 10) * 1000
  return null
}

/**
 * Execute a fetch with automatic retry on 429/rate-limit errors.
 * Uses the provided gate for concurrency control.
 */
export async function fetchWithGate(
  gate: RequestGate,
  doFetch: () => Promise<Response>,
  opts?: { maxRetries?: number; signal?: AbortSignal },
): Promise<Response> {
  const maxRetries = opts?.maxRetries ?? 4

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    await gate.acquire()
    let response: Response
    try {
      response = await doFetch()
    } catch (err) {
      gate.release()
      // Network errors on last attempt → throw
      if (attempt === maxRetries) throw err
      // Network errors → retry after backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 15000) + Math.random() * 500
      await new Promise(r => setTimeout(r, delay))
      continue
    }

    if (response.status === 429 && attempt < maxRetries) {
      gate.release()
      // Parse retry-after from response headers or body
      const retryAfterHeader = response.headers.get('Retry-After')
      let delay: number
      if (retryAfterHeader) {
        delay = parseInt(retryAfterHeader, 10) * 1000
      } else {
        // Try to read the error body for "retry after N seconds"
        try {
          const text = await response.text()
          delay = parseRetryAfter(text) ?? Math.min(1500 * Math.pow(2, attempt), 15000)
        } catch {
          delay = Math.min(1500 * Math.pow(2, attempt), 15000)
        }
      }
      // Add jitter
      delay += Math.random() * 800
      await new Promise(r => setTimeout(r, delay))
      continue
    }

    // Not a 429, or last attempt — return the response and let caller handle
    gate.release()
    return response
  }

  // Should never reach here, but satisfy TypeScript
  throw new Error('Request gate: exhausted retries')
}
