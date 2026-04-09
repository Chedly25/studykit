import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock requestGate to bypass concurrency/delay logic
vi.mock('../../lib/requestGate', () => ({
  llmGate: {},
  fetchWithGate: vi.fn((_gate: unknown, doFetch: () => Promise<Response>) => doFetch()),
}))

import { streamChat, QuotaExceededError } from '../client'
import type { Message, ToolDefinition } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────

function makeSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const lines = events.map(e => `data: ${e}\n\n`).join('')
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines))
      controller.close()
    },
  })
}

function sseResponse(events: string[], status = 200): Response {
  return new Response(makeSSEStream(events), {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(text: string, status: number): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  })
}

const baseOpts = {
  messages: [{ id: '1', role: 'user' as const, content: 'Hello' }] as Message[],
  system: 'You are helpful.',
  tools: [] as ToolDefinition[],
  authToken: 'test-token',
}

// ─── Tests ───────────────────────────────────────────────────────

describe('streamChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('parses text content from SSE stream', async () => {
    const events = [
      JSON.stringify({ choices: [{ delta: { content: 'Hello' }, finish_reason: null }] }),
      JSON.stringify({ choices: [{ delta: { content: ' world' }, finish_reason: 'stop' }] }),
      '[DONE]',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const result = await streamChat(baseOpts)

    expect(result.content).toEqual([{ type: 'text', text: 'Hello world' }])
    expect(result.stopReason).toBe('stop')
    expect(result.reasoningContent).toBeUndefined()
  })

  it('calls onToken for each text delta', async () => {
    const events = [
      JSON.stringify({ choices: [{ delta: { content: 'A' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'B' } }] }),
      '[DONE]',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const tokens: string[] = []
    await streamChat({ ...baseOpts, onToken: t => tokens.push(t) })

    expect(tokens).toEqual(['A', 'B'])
  })

  it('parses tool calls from SSE stream', async () => {
    const events = [
      JSON.stringify({
        choices: [{
          delta: {
            tool_calls: [{ index: 0, id: 'tc1', function: { name: 'search', arguments: '{"q":' } }],
          },
        }],
      }),
      JSON.stringify({
        choices: [{
          delta: {
            tool_calls: [{ index: 0, function: { arguments: '"test"}' } }],
          },
        }],
      }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
      '[DONE]',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const toolNames: string[] = []
    const result = await streamChat({ ...baseOpts, onToolCall: n => toolNames.push(n) })

    expect(result.content).toEqual([
      { type: 'tool_use', id: 'tc1', name: 'search', input: { q: 'test' } },
    ])
    expect(result.stopReason).toBe('tool_calls')
    expect(toolNames).toEqual(['search'])
  })

  it('handles malformed tool call JSON with repair', async () => {
    const events = [
      JSON.stringify({
        choices: [{
          delta: {
            tool_calls: [{ index: 0, id: 'tc1', function: { name: 'fn', arguments: '{"a":1}extra' } }],
          },
        }],
      }),
      '[DONE]',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const result = await streamChat(baseOpts)

    // Should repair by finding last valid brace
    expect(result.content[0]).toEqual(
      expect.objectContaining({ type: 'tool_use', name: 'fn', input: { a: 1 } }),
    )
  })

  it('handles completely unparseable tool call args gracefully (no brace)', async () => {
    const events = [
      JSON.stringify({
        choices: [{
          delta: {
            tool_calls: [{ index: 0, id: 'tc1', function: { name: 'fn', arguments: 'not json at all' } }],
          },
        }],
      }),
      '[DONE]',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const result = await streamChat(baseOpts)

    // No brace found, repair skipped silently, input defaults to {}
    expect(result.content[0]).toEqual(
      expect.objectContaining({ type: 'tool_use', name: 'fn', input: {} }),
    )
  })

  it('warns when tool call args have brace but still invalid JSON', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const events = [
      JSON.stringify({
        choices: [{
          delta: {
            tool_calls: [{ index: 0, id: 'tc1', function: { name: 'fn', arguments: 'abc}xyz' } }],
          },
        }],
      }),
      '[DONE]',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const result = await streamChat(baseOpts)

    expect(result.content[0]).toEqual(
      expect.objectContaining({ type: 'tool_use', name: 'fn', input: {} }),
    )
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('parses reasoning_content from SSE stream', async () => {
    const events = [
      JSON.stringify({ choices: [{ delta: { reasoning_content: 'thinking...' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'Answer' }, finish_reason: 'stop' }] }),
      '[DONE]',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const result = await streamChat(baseOpts)

    expect(result.reasoningContent).toBe('thinking...')
    expect(result.content).toEqual([{ type: 'text', text: 'Answer' }])
  })

  it('handles Cloudflare Workers AI format', async () => {
    const events = [
      JSON.stringify({ response: 'Hi ' }),
      JSON.stringify({ response: 'there' }),
      '[DONE]',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const tokens: string[] = []
    const result = await streamChat({ ...baseOpts, onToken: t => tokens.push(t) })

    expect(result.content).toEqual([{ type: 'text', text: 'Hi there' }])
    expect(tokens).toEqual(['Hi ', 'there'])
  })

  it('retries with fresh token on 401', async () => {
    const events = [
      JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }),
      '[DONE]',
    ]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(textResponse('Unauthorized', 401))
      .mockResolvedValueOnce(sseResponse(events))
    vi.stubGlobal('fetch', fetchMock)

    const getToken = vi.fn().mockResolvedValue('fresh-token')
    const result = await streamChat({ ...baseOpts, getToken })

    expect(getToken).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.content).toEqual([{ type: 'text', text: 'ok' }])
  })

  it('does not retry 401 without getToken', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse('Unauthorized', 401)))

    // JSON.parse("Unauthorized") throws SyntaxError, which is re-thrown by the catch
    await expect(streamChat(baseOpts)).rejects.toThrow()
  })

  it('throws QuotaExceededError on QUOTA_EXCEEDED response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ code: 'QUOTA_EXCEEDED', error: 'Daily limit reached', limit: 10, used: 10 }, 429),
    ))

    try {
      await streamChat(baseOpts)
      expect.unreachable('should throw')
    } catch (err) {
      expect(err).toBeInstanceOf(QuotaExceededError)
      const qe = err as QuotaExceededError
      expect(qe.code).toBe('QUOTA_EXCEEDED')
      expect(qe.limit).toBe(10)
      expect(qe.used).toBe(10)
    }
  })

  it('throws on generic API error with JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: 'Something broke' }, 500),
    ))

    await expect(streamChat(baseOpts)).rejects.toThrow('Something broke')
  })

  it('throws on API error with non-JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(textResponse('Internal Server Error', 500)))

    // JSON.parse fails, SyntaxError is re-thrown because it doesn't start with 'API error'
    await expect(streamChat(baseOpts)).rejects.toThrow()
  })

  it('throws API error when JSON has no error/code fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ status: 'error', detail: 'something' }, 500),
    ))

    await expect(streamChat(baseOpts)).rejects.toThrow('API error 500')
  })

  it('throws on 200 JSON error responses (Cloudflare 502 workaround)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: 'Model overloaded', detail: 'Try again' }, 200),
    ))

    await expect(streamChat(baseOpts)).rejects.toThrow('Model overloaded [Try again]')
  })

  it('throws when response body is missing', async () => {
    // Create a response with no body by using text/event-stream but null body
    const res = new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res))

    await expect(streamChat(baseOpts)).rejects.toThrow('No response body')
  })

  it('includes model and tools in request body', async () => {
    const events = [
      JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }),
      '[DONE]',
    ]
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(events))
    vi.stubGlobal('fetch', fetchMock)

    const tool: ToolDefinition = {
      name: 'search',
      description: 'Search things',
      input_schema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
    }

    await streamChat({ ...baseOpts, tools: [tool], model: 'gpt-4o' })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('gpt-4o')
    expect(body.tools).toEqual([{
      type: 'function',
      function: { name: 'search', description: 'Search things', parameters: tool.input_schema },
    }])
    expect(body.stream).toBe(true)
  })

  it('sends authorization header when authToken provided', async () => {
    const events = ['[DONE]']
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(events))
    vi.stubGlobal('fetch', fetchMock)

    await streamChat(baseOpts)

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer test-token')
  })

  it('converts messages with tool_use content blocks', async () => {
    const events = [
      JSON.stringify({ choices: [{ delta: { content: 'done' }, finish_reason: 'stop' }] }),
      '[DONE]',
    ]
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(events))
    vi.stubGlobal('fetch', fetchMock)

    const messages: Message[] = [
      { id: '1', role: 'user', content: 'search for cats' },
      {
        id: '2', role: 'assistant', content: [
          { type: 'text', text: 'Let me search.' },
          { type: 'tool_use', id: 'tc1', name: 'search', input: { q: 'cats' } },
        ],
        reasoning_content: 'I should search',
      },
      {
        id: '3', role: 'user', content: [
          { type: 'tool_result', tool_use_id: 'tc1', content: 'Found cats!' },
        ],
      },
    ]

    await streamChat({ ...baseOpts, messages })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    // System message + 3 converted messages (user, assistant w/ tool_calls, tool result)
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'search for cats' })
    expect(body.messages[2].role).toBe('assistant')
    expect(body.messages[2].tool_calls[0].function.name).toBe('search')
    expect(body.messages[2].reasoning_content).toBe('I should search')
    expect(body.messages[3].role).toBe('tool')
    expect(body.messages[3].tool_call_id).toBe('tc1')
  })

  it('converts messages with text-only array content', async () => {
    const events = ['[DONE]']
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(events))
    vi.stubGlobal('fetch', fetchMock)

    const messages: Message[] = [
      {
        id: '1', role: 'user', content: [
          { type: 'text', text: 'Part 1. ' },
          { type: 'text', text: 'Part 2.' },
        ],
      },
    ]

    await streamChat({ ...baseOpts, messages })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Part 1. Part 2.' })
  })

  it('converts string messages with reasoning_content', async () => {
    const events = ['[DONE]']
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(events))
    vi.stubGlobal('fetch', fetchMock)

    const messages: Message[] = [
      { id: '1', role: 'assistant', content: 'Answer', reasoning_content: 'My thinking' },
    ]

    await streamChat({ ...baseOpts, messages })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[1]).toEqual({
      role: 'assistant',
      content: 'Answer',
      reasoning_content: 'My thinking',
    })
  })

  it('skips empty system message', async () => {
    const events = ['[DONE]']
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(events))
    vi.stubGlobal('fetch', fetchMock)

    await streamChat({ ...baseOpts, system: '' })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    // Should not have a system message
    expect(body.messages[0].role).not.toBe('system')
  })

  it('handles SSE events with no choices gracefully', async () => {
    const events = [
      JSON.stringify({}), // no choices
      JSON.stringify({ choices: [] }), // empty choices
      JSON.stringify({ choices: [{}] }), // no delta
      JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }),
      '[DONE]',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const result = await streamChat(baseOpts)
    expect(result.content).toEqual([{ type: 'text', text: 'ok' }])
  })

  it('skips non-SSE lines (no "data: " prefix)', async () => {
    // Manually create a stream with mixed lines
    const encoder = new TextEncoder()
    const raw = ': comment\nevent: ping\ndata: ' +
      JSON.stringify({ choices: [{ delta: { content: 'hi' }, finish_reason: 'stop' }] }) +
      '\n\ndata: [DONE]\n\n'
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(raw))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    ))

    const result = await streamChat(baseOpts)
    expect(result.content).toEqual([{ type: 'text', text: 'hi' }])
  })

  it('returns empty content when stream has no data', async () => {
    const events = ['[DONE]']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(events)))

    const result = await streamChat(baseOpts)
    expect(result.content).toEqual([])
    expect(result.stopReason).toBeNull()
  })
})

describe('QuotaExceededError', () => {
  it('has correct properties', () => {
    const err = new QuotaExceededError('Limit reached', 50, 50)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('QuotaExceededError')
    expect(err.code).toBe('QUOTA_EXCEEDED')
    expect(err.limit).toBe(50)
    expect(err.used).toBe(50)
    expect(err.message).toBe('Limit reached')
  })
})
