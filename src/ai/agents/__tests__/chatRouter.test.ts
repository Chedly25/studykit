import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../fastClient', () => ({
  callFastModel: vi.fn(),
}))

import { routeChat } from '../chatRouter'
import { callFastModel } from '../../fastClient'
import type { Message } from '../../types'

const mockLLM = vi.mocked(callFastModel)

function makeMessages(count: number): Message[] {
  const msgs: Message[] = []
  for (let i = 0; i < count; i++) {
    msgs.push({ id: crypto.randomUUID(), role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}` })
  }
  return msgs
}

describe('routeChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default for <=2 user messages (no LLM call)', async () => {
    const msgs = makeMessages(3) // 2 user, 1 assistant
    const result = await routeChat(msgs, undefined, null, [], 'token')
    expect(result.style).toBe('teach')
    expect(result.addendum).toBe('')
    expect(mockLLM).not.toHaveBeenCalled()
  })

  it('calls LLM and parses valid routing response', async () => {
    mockLLM.mockResolvedValue('{ "style": "question", "addendum": "Test understanding with a question" }')

    const msgs = makeMessages(7) // 4 user messages
    const result = await routeChat(msgs, undefined, null, [], 'token')
    expect(result.style).toBe('question')
    expect(result.addendum).toBe('Test understanding with a question')
    expect(mockLLM).toHaveBeenCalledTimes(1)
  })

  it('returns default on LLM failure', async () => {
    mockLLM.mockRejectedValue(new Error('API error'))

    const msgs = makeMessages(7)
    const result = await routeChat(msgs, undefined, null, [], 'token')
    expect(result.style).toBe('teach')
    expect(result.addendum).toBe('')
  })

  it('returns default on malformed JSON', async () => {
    mockLLM.mockResolvedValue('not json at all')

    const msgs = makeMessages(7)
    const result = await routeChat(msgs, undefined, null, [], 'token')
    expect(result.style).toBe('teach')
  })

  it('rejects invalid style values', async () => {
    mockLLM.mockResolvedValue('{ "style": "invalid_style", "addendum": "test" }')

    const msgs = makeMessages(7)
    const result = await routeChat(msgs, undefined, null, [], 'token')
    expect(result.style).toBe('teach') // falls back to default
  })

  it('includes topic info when provided', async () => {
    mockLLM.mockResolvedValue('{ "style": "challenge", "addendum": "Push harder" }')

    const msgs = makeMessages(7)
    const result = await routeChat(
      msgs, undefined,
      { name: 'Probability', mastery: 0.85, confidence: 0.9 },
      [], 'token',
    )
    expect(result.style).toBe('challenge')
    // Verify the LLM was called with topic info
    expect(mockLLM).toHaveBeenCalledWith(
      expect.stringContaining('Probability'),
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    )
  })
})
