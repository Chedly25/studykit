import { describe, it, expect, vi } from 'vitest'
import { createStreamExtractor } from '../streamJsonExtractor'

describe('createStreamExtractor', () => {
  it('extracts all objects when fed complete JSON at once', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ id: number; name: string }>('items', { onItem })

    ext.feed('{"items": [{"id": 1, "name": "first"}, {"id": 2, "name": "second"}]}')

    const items = ext.finalize()
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({ id: 1, name: 'first' })
    expect(items[1]).toEqual({ id: 2, name: 'second' })
  })

  it('handles tokens arriving one character at a time', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ v: number }>('data', { onItem })

    const json = '{"data": [{"v": 42}]}'
    for (const ch of json) ext.feed(ch)

    expect(ext.finalize()).toEqual([{ v: 42 }])
    expect(onItem).toHaveBeenCalledWith({ v: 42 }, 0)
  })

  it('strips markdown code fences', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ x: number }>('arr', { onItem })

    ext.feed('```json\n{"arr": [{"x": 1}]}\n```')
    expect(ext.finalize()).toEqual([{ x: 1 }])
  })

  it('emits first item as soon as it completes', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ n: number }>('items', { onItem })

    ext.feed('{"items": [{"n": 1},')
    expect(onItem).toHaveBeenCalledTimes(1)
    expect(onItem).toHaveBeenCalledWith({ n: 1 }, 0)
  })

  it('handles strings with escaped characters', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ text: string }>('items', { onItem })

    ext.feed('{"items": [{"text": "hello \\"world\\""}]}')
    const items = ext.finalize()
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('hello "world"')
  })

  it('handles nested objects', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ a: { b: number } }>('items', { onItem })

    ext.feed('{"items": [{"a": {"b": 99}}]}')
    expect(ext.finalize()).toEqual([{ a: { b: 99 } }])
  })

  it('handles deeply nested braces', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ x: { y: { z: number } } }>('items', { onItem })

    ext.feed('{"items": [{"x": {"y": {"z": 1}}}]}')
    expect(ext.finalize()).toEqual([{ x: { y: { z: 1 } } }])
  })

  it('returns empty array when no matching key found', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ x: number }>('missing', { onItem })

    ext.feed('{"other": [{"x": 1}]}')
    expect(ext.finalize()).toEqual([])
    expect(onItem).not.toHaveBeenCalled()
  })

  it('returns empty array for empty input', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ x: number }>('items', { onItem })
    expect(ext.finalize()).toEqual([])
  })

  it('fallback: parses entire buffer on finalize when streaming extraction missed items', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ id: number }>('items', { onItem })

    ext.feed('{"items":[{"id":5}]}')
    const items = ext.finalize()
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(5)
  })

  it('getItems returns current state', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ n: number }>('items', { onItem })

    expect(ext.getItems()).toEqual([])
    ext.feed('{"items": [{"n": 1}]}')
    expect(ext.getItems().length).toBeGreaterThanOrEqual(1)
  })

  it('handles strings containing braces', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ code: string }>('items', { onItem })

    ext.feed('{"items": [{"code": "function() { return {} }"}]}')
    const items = ext.finalize()
    expect(items).toHaveLength(1)
    expect(items[0].code).toBe('function() { return {} }')
  })

  it('handles empty array', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ x: number }>('items', { onItem })

    ext.feed('{"items": []}')
    expect(ext.finalize()).toEqual([])
    expect(onItem).not.toHaveBeenCalled()
  })

  it('handles multiple arrays but only extracts target key', () => {
    const onItem = vi.fn()
    const ext = createStreamExtractor<{ id: number }>('target', { onItem })

    ext.feed('{"other": [{"id": 99}], "target": [{"id": 1}]}')
    const items = ext.finalize()
    expect(items.some(i => i.id === 1)).toBe(true)
  })
})
