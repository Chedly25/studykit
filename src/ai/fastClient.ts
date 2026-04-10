/**
 * Fast pipeline LLM client — calls Claude Haiku via /api/fast.
 * Pro only. Throws ProRequiredError if user is not Pro.
 */
import { fastGate, fetchWithGate } from '../lib/requestGate'

const FAST_URL = '/api/fast'

export class ProRequiredError extends Error {
  code = 'PRO_REQUIRED' as const
  constructor(message: string) {
    super(message)
    this.name = 'ProRequiredError'
  }
}

/**
 * Call the fast pipeline model (Claude Haiku). Pro only.
 * Throws ProRequiredError if user is not on Pro plan.
 */
export async function callFastModel(
  prompt: string,
  system: string,
  authToken: string,
  opts?: { maxTokens?: number; signal?: AbortSignal },
): Promise<string> {
  let lastError: Error | null = null

  // Retry with exponential backoff on 429/5xx
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r, rej) => {
        const t = setTimeout(r, Math.min(1500 * 2 ** attempt, 30000))
        opts?.signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')) })
      })
    }

    const response = await fetchWithGate(fastGate, () =>
      fetch(FAST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          prompt,
          system,
          maxTokens: opts?.maxTokens ?? 4096,
        }),
        signal: opts?.signal,
      }),
      { signal: opts?.signal },
    )

    if (response.status === 403) {
      throw new ProRequiredError('This feature requires a Pro plan')
    }

    // Retryable errors
    if (response.status === 429 || response.status >= 500) {
      const errText = await response.text().catch(() => '')
      lastError = new Error(`Fast model error ${response.status}: ${errText.slice(0, 200)}`)
      continue
    }

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Fast model error ${response.status}: ${errText.slice(0, 200)}`)
    }

    const data = await response.json() as { text?: string; error?: string }
    if (data.error) {
      if (data.error.includes('Pro')) {
        throw new ProRequiredError(data.error)
      }
      throw new Error(data.error)
    }
    return data.text ?? ''
  }

  throw lastError ?? new Error('Fast model call failed after retries')
}
