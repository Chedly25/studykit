/**
 * Single source of truth for checking whether a URL's effective domain
 * is present in an allowlist. Used by:
 *  - the Tavily client (defense-in-depth after server response)
 *  - the server-side Tavily endpoint (validate client-supplied includeDomains
 *    against a whitelist and reject off-list URLs in Tavily's response)
 *  - the legalFiche enrichment pipeline (re-check URLs in synthesized output)
 *
 * Host matching rules:
 *  - Compare lowercased host with `example.com` entry: match if host === entry
 *    OR host ends with `.entry` (so `www.example.com` and `sub.example.com` match).
 *  - Strip trailing dots and ports.
 *  - Rejects obvious bypass attempts (protocol-relative, malformed, non-http(s)).
 */

function hostOf(input: string): string | null {
  // Accept full URL, domain only, or protocol-relative
  let candidate = input.trim()
  if (!candidate) return null
  if (candidate.startsWith('//')) candidate = 'https:' + candidate
  if (!/^https?:\/\//i.test(candidate)) {
    // Bare domain — wrap to parse
    candidate = 'https://' + candidate
  }
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    let h = url.hostname.toLowerCase()
    if (h.endsWith('.')) h = h.slice(0, -1)
    return h
  } catch {
    return null
  }
}

/**
 * Does the URL's effective host belong to the allowlist?
 * Allowlist entries are bare domains (e.g. "courdecassation.fr").
 * Subdomains match by suffix (so `www.courdecassation.fr` passes against `courdecassation.fr`).
 */
export function isHostInAllowlist(urlOrHost: string, allowlist: string[]): boolean {
  const host = hostOf(urlOrHost)
  if (!host) return false
  for (const allowed of allowlist) {
    const bare = allowed.toLowerCase().replace(/^\*\./, '').replace(/\.$/, '')
    if (host === bare) return true
    if (host.endsWith('.' + bare)) return true
  }
  return false
}

/**
 * Extract all markdown-link URLs from a block of text.
 * Matches `[text](https://example.com/path)` pattern.
 */
export function extractMarkdownUrls(markdown: string): string[] {
  const urls: string[] = []
  const rx = /\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(markdown)) !== null) {
    urls.push(m[1])
  }
  return urls
}

/**
 * Returns the subset of URLs in `markdown` that are NOT in the allowlist.
 * Used as a final gate on LLM-synthesized output: any off-list URL returned here
 * is a cause to reject/retry.
 */
export function findOffAllowlistUrls(markdown: string, allowlist: string[]): string[] {
  return extractMarkdownUrls(markdown).filter(u => !isHostInAllowlist(u, allowlist))
}
