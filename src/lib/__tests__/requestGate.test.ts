import { describe, it, expect } from 'vitest'
import { parseRetryAfter } from '../requestGate'

describe('parseRetryAfter', () => {
  it('extracts seconds from "retry after N seconds" message', () => {
    expect(parseRetryAfter('Please retry after 5 seconds')).toBe(5000)
    expect(parseRetryAfter('retry after 30 seconds')).toBe(30000)
  })

  it('returns null when no retry-after pattern found', () => {
    expect(parseRetryAfter('Some other error')).toBeNull()
    expect(parseRetryAfter('')).toBeNull()
  })
})

// Note: Full concurrency/gap tests for RequestGate class would require
// timing-sensitive assertions. The class is not exported, but we test
// the public API (parseRetryAfter) and trust the gate's acquire/release
// mechanism through integration usage.
