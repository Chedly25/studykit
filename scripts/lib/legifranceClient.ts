 
/**
 * Shared Legifrance / PISTE client helpers for ingest scripts.
 * Lives here so constitution/déontologie/other ingests don't duplicate auth code.
 */

const PISTE_OAUTH_URL = 'https://oauth.piste.gouv.fr/api/oauth/token'
const LEGIFRANCE_BASE = 'https://api.piste.gouv.fr/dila/legifrance/lf-engine-app'

let cached: { token: string; expiresAt: number } | null = null

export async function getPisteToken(clientId: string, clientSecret: string): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const res = await fetch(PISTE_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'openid',
    }),
  })
  if (!res.ok) throw new Error(`PISTE OAuth failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

export async function pisteCall(
  path: string,
  body: unknown,
  clientId: string,
  clientSecret: string,
): Promise<unknown> {
  const token = await getPisteToken(clientId, clientSecret)
  const res = await fetch(`${LEGIFRANCE_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PISTE ${path}: ${res.status} ${text.slice(0, 300)}`)
  }
  return res.json()
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface ArticleInfo {
  articleId: string
  num: string
  breadcrumb: string[]
  etat: string
}

export interface FetchedArticle extends ArticleInfo {
  text: string
  wordCount: number
}

export interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

export function extractArticles(
  sections: unknown[],
  breadcrumb: string[] = [],
): ArticleInfo[] {
  const articles: ArticleInfo[] = []
  for (const section of sections) {
    const s = section as Record<string, unknown>
    const rawTitle =
      typeof s.title === 'string' ? s.title : typeof s.titre === 'string' ? s.titre : ''
    const title = rawTitle.replace(/<[^>]+>/g, '').trim()
    const currentBreadcrumb = title ? [...breadcrumb, title] : breadcrumb

    const arts = (s.articles ?? s.extractsArticle ?? []) as Array<Record<string, string>>
    for (const art of arts) {
      const id = art.id ?? art.cid ?? ''
      const num = art.num ?? ''
      const etat = art.etat ?? art.legalStatus ?? ''
      if (id && etat !== 'ABROGE') {
        articles.push({ articleId: id, num, breadcrumb: currentBreadcrumb, etat })
      }
    }

    const children = (s.sections ?? s.children ?? []) as unknown[]
    if (Array.isArray(children) && children.length > 0) {
      articles.push(...extractArticles(children, currentBreadcrumb))
    }
  }
  return articles
}

export async function fetchTableMatieres(
  textId: string,
  clientId: string,
  clientSecret: string,
): Promise<ArticleInfo[]> {
  const data = (await pisteCall(
    '/consult/code/tableMatieres',
    { textId, date: new Date().toISOString().slice(0, 10) },
    clientId,
    clientSecret,
  )) as Record<string, unknown>
  const sections = (data.sections ?? data.children ?? data.tableMatieres ?? []) as unknown[]
  return extractArticles(Array.isArray(sections) ? sections : [])
}

/** For laws/decrees/Constitution (NATURE ≠ CODE). */
export async function fetchLegiPart(
  textId: string,
  clientId: string,
  clientSecret: string,
): Promise<ArticleInfo[]> {
  const data = (await pisteCall(
    '/consult/legiPart',
    { textId, date: new Date().toISOString().slice(0, 10) },
    clientId,
    clientSecret,
  )) as Record<string, unknown>
  const infos: ArticleInfo[] = []
  // Top-level loose articles
  const topArts = (data.articles ?? []) as Array<Record<string, string>>
  for (const art of topArts) {
    const id = art.id ?? art.cid ?? ''
    if (id && (art.etat ?? art.legalStatus ?? '') !== 'ABROGE') {
      infos.push({ articleId: id, num: art.num ?? '', breadcrumb: [], etat: art.etat ?? 'VIGUEUR' })
    }
  }
  // Sections (nested)
  const sections = (data.sections ?? []) as unknown[]
  infos.push(...extractArticles(Array.isArray(sections) ? sections : []))
  return infos
}

export async function fetchArticle(
  articleId: string,
  clientId: string,
  clientSecret: string,
): Promise<{ num: string; text: string; etat: string } | null> {
  try {
    const data = (await pisteCall(
      '/consult/getArticle',
      { id: articleId },
      clientId,
      clientSecret,
    )) as Record<string, unknown>
    const article = (data.article ?? data) as Record<string, string>
    const html = article.texteHtml ?? article.texte ?? article.content ?? ''
    if (!html) return null
    return {
      num: article.num ?? '',
      text: stripHtml(html),
      etat: article.etat ?? 'VIGUEUR',
    }
  } catch {
    return null
  }
}

export async function fetchArticlesBatch(
  articles: ArticleInfo[],
  clientId: string,
  clientSecret: string,
  concurrency = 10,
  delayMs = 200,
): Promise<FetchedArticle[]> {
  const out: FetchedArticle[] = []
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency)
    const fetched = await Promise.all(
      batch.map(async (art) => {
        const r = await fetchArticle(art.articleId, clientId, clientSecret)
        if (!r || r.etat === 'ABROGE' || !r.text.trim()) return null
        return {
          ...art,
          num: r.num || art.num,
          text: r.text,
          wordCount: r.text.split(/\s+/).length,
        } as FetchedArticle
      }),
    )
    out.push(...fetched.filter((x): x is FetchedArticle => x !== null))
    if (i + concurrency < articles.length) await sleep(delayMs)
  }
  return out
}

export function chunkArticles(
  articles: FetchedArticle[],
  codeName: string,
  codeSlug: string,
): Chunk[] {
  const chunks: Chunk[] = []
  for (const art of articles) {
    const breadcrumb = art.breadcrumb.join(' > ')
    if (art.wordCount > 400) {
      const paragraphs = art.text.split(/\n\n+/).filter((p) => p.trim())
      let buffer = ''
      let partIndex = 0
      for (const para of paragraphs) {
        const combined = buffer ? `${buffer}\n\n${para}` : para
        if (combined.split(/\s+/).length > 400 && buffer) {
          chunks.push({
            id: `${codeSlug}-art-${slugify(art.num)}-p${partIndex}`,
            codeName,
            num: art.num,
            breadcrumb,
            text: `Art. ${art.num} — ${buffer}`,
          })
          partIndex++
          buffer = para
        } else {
          buffer = combined
        }
      }
      if (buffer) {
        chunks.push({
          id: `${codeSlug}-art-${slugify(art.num)}${partIndex > 0 ? `-p${partIndex}` : ''}`,
          codeName,
          num: art.num,
          breadcrumb,
          text: `Art. ${art.num} — ${buffer}`,
        })
      }
    } else {
      chunks.push({
        id: `${codeSlug}-art-${slugify(art.num)}`,
        codeName,
        num: art.num,
        breadcrumb,
        text: `Art. ${art.num} — ${art.text}`,
      })
    }
  }
  return chunks
}
