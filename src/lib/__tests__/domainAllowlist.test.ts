import { describe, it, expect } from 'vitest'
import {
  extractMarkdownUrls,
  findOffAllowlistUrls,
  isHostInAllowlist,
} from '../domainAllowlist'

describe('isHostInAllowlist', () => {
  const list = ['courdecassation.fr', 'legifrance.gouv.fr', 'conseil-etat.fr']

  it('accepts exact-host match', () => {
    expect(isHostInAllowlist('https://courdecassation.fr/some/path', list)).toBe(true)
  })

  it('accepts subdomains by suffix', () => {
    expect(isHostInAllowlist('https://www.courdecassation.fr/a', list)).toBe(true)
    expect(isHostInAllowlist('https://sub.legifrance.gouv.fr/x', list)).toBe(true)
  })

  it('rejects lookalike substrings', () => {
    expect(isHostInAllowlist('https://fakecourdecassation.fr/x', list)).toBe(false)
    expect(isHostInAllowlist('https://courdecassation.fr.evil.com/x', list)).toBe(false)
  })

  it('rejects off-list domains', () => {
    expect(isHostInAllowlist('https://evil.com/x', list)).toBe(false)
    expect(isHostInAllowlist('https://village-justice.com/a', list)).toBe(false)
  })

  it('handles bare-domain inputs', () => {
    expect(isHostInAllowlist('courdecassation.fr', list)).toBe(true)
    expect(isHostInAllowlist('www.courdecassation.fr', list)).toBe(true)
  })

  it('rejects non-http protocols', () => {
    expect(isHostInAllowlist('ftp://courdecassation.fr/x', list)).toBe(false)
    expect(isHostInAllowlist('javascript:alert(1)', list)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isHostInAllowlist('https://CourDeCassation.FR/x', list)).toBe(true)
  })

  it('returns false on malformed input', () => {
    expect(isHostInAllowlist('', list)).toBe(false)
    expect(isHostInAllowlist('not a url', list)).toBe(false)
  })

  it('handles trailing dot in hostname', () => {
    expect(isHostInAllowlist('https://courdecassation.fr./x', list)).toBe(true)
  })
})

describe('extractMarkdownUrls', () => {
  it('extracts a single URL', () => {
    expect(extractMarkdownUrls('foo [bar](https://example.com/x) baz')).toEqual(['https://example.com/x'])
  })

  it('extracts multiple URLs', () => {
    const md = 'a [x](https://a.com) b [y](https://b.com/path?q=1) c'
    expect(extractMarkdownUrls(md)).toEqual(['https://a.com', 'https://b.com/path?q=1'])
  })

  it('ignores plain-text URLs', () => {
    expect(extractMarkdownUrls('see https://example.com')).toEqual([])
  })

  it('handles empty input', () => {
    expect(extractMarkdownUrls('')).toEqual([])
  })
})

describe('findOffAllowlistUrls', () => {
  const allow = ['courdecassation.fr', 'dalloz-actualite.fr']

  it('returns empty when all URLs are allowed', () => {
    const md = '- [source](https://courdecassation.fr/a) and [doc](https://www.dalloz-actualite.fr/x)'
    expect(findOffAllowlistUrls(md, allow)).toEqual([])
  })

  it('returns the off-list URLs', () => {
    const md = '- [a](https://courdecassation.fr/1) [b](https://village-justice.com/x)'
    expect(findOffAllowlistUrls(md, allow)).toEqual(['https://village-justice.com/x'])
  })

  it('returns all off-list URLs when none match', () => {
    const md = '[x](https://a.com) [y](https://b.com)'
    expect(findOffAllowlistUrls(md, allow)).toEqual(['https://a.com', 'https://b.com'])
  })
})
