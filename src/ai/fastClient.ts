/**
 * Fast pipeline LLM client — calls Claude Haiku via /api/fast.
 * Non-streaming, for structured extraction and classification tasks.
 */
import { fastGate, fetchWithGate } from '../lib/requestGate'

const FAST_URL = '/api/fast'

/**
 * Call the fast pipeline model (Claude Haiku).
 * Returns plain text response — no streaming, no tool use.
 */
export async function callFastModel(
  prompt: string,
  system: string,
  authToken: string,
  opts?: { maxTokens?: number; signal?: AbortSignal },
): Promise<string> {
  const body = JSON.stringify({
    prompt,
    system,
    maxTokens: opts?.maxTokens ?? 4096,
  })

  const response = await fetchWithGate(fastGate, () =>
    fetch(FAST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body,
      signal: opts?.signal,
    }),
    { signal: opts?.signal },
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Fast model error ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = await response.json() as { text?: string; error?: string }
  if (data.error) throw new Error(data.error)
  return data.text ?? ''
}
