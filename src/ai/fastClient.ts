/**
 * Fast pipeline LLM client — calls Claude Haiku via /api/fast.
 * Falls back to main /api/chat (Kimi) if user is not Pro.
 * Non-streaming, for structured extraction and classification tasks.
 */
import { fastGate, llmGate, fetchWithGate } from '../lib/requestGate'

const FAST_URL = '/api/fast'
const CHAT_URL = '/api/chat'

/**
 * Call the fast pipeline model (Claude Haiku for Pro, Kimi fallback for free).
 * Returns plain text response — no streaming, no tool use.
 */
export async function callFastModel(
  prompt: string,
  system: string,
  authToken: string,
  opts?: { maxTokens?: number; signal?: AbortSignal },
): Promise<string> {
  // Try fast model first (Pro users → Haiku)
  const fastResponse = await fetchWithGate(fastGate, () =>
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

  // If 403 (not Pro), fall back to main chat endpoint
  if (fastResponse.status === 403) {
    return callMainModel(prompt, system, authToken, opts)
  }

  if (!fastResponse.ok) {
    const errText = await fastResponse.text()
    throw new Error(`Fast model error ${fastResponse.status}: ${errText.slice(0, 200)}`)
  }

  const data = await fastResponse.json() as { text?: string; error?: string }
  if (data.error) {
    // If error mentions Pro plan, fall back
    if (data.error.includes('Pro')) {
      return callMainModel(prompt, system, authToken, opts)
    }
    throw new Error(data.error)
  }
  return data.text ?? ''
}

/**
 * Fallback: call the main /api/chat endpoint (Kimi) in non-streaming mode.
 * Used for free users who can't access /api/fast.
 */
async function callMainModel(
  prompt: string,
  system: string,
  authToken: string,
  opts?: { maxTokens?: number; signal?: AbortSignal },
): Promise<string> {
  const response = await fetchWithGate(llmGate, () =>
    fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_tokens: opts?.maxTokens ?? 4096,
        stream: false,
      }),
      signal: opts?.signal,
    }),
    { signal: opts?.signal },
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`LLM error ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
    error?: string
  }
  if (data.error) throw new Error(data.error)
  return data.choices?.[0]?.message?.content ?? ''
}
