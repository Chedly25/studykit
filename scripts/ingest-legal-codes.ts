#!/usr/bin/env npx tsx
/**
 * Ingest all French legal codes from Legifrance into Vectorize-ready NDJSON.
 *
 * Two modes:
 *   --proxy  Uses your deployed admin endpoint (only needs --auth-token, recommended)
 *   Direct   Uses PISTE credentials directly (needs --piste-client-id + --piste-client-secret)
 *
 * Usage (proxy mode — easiest, uses server-side PISTE creds):
 *   npx tsx scripts/ingest-legal-codes.ts \
 *     --proxy --auth-token $TOKEN \
 *     [--codes "Code civil,Code pénal"]
 *
 * Usage (direct mode):
 *   npx tsx scripts/ingest-legal-codes.ts \
 *     --piste-client-id $ID --piste-client-secret $SECRET \
 *     [--auth-token $TOKEN] [--codes "Code civil,Code pénal"]
 *
 * After running, upload vectors to Vectorize:
 *   for f in legal-output/vectors/batch-*.ndjson; do
 *     wrangler vectorize insert legal-codes --file="$f"
 *   done
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'

// ─── CLI args ───────────────────────────────────────────

const { values } = parseArgs({
  options: {
    'output-dir': { type: 'string', default: 'legal-output' },
    'piste-client-id': { type: 'string' },
    'piste-client-secret': { type: 'string' },
    'api-url': { type: 'string', default: 'https://studieskit.com' },
    'auth-token': { type: 'string' },
    'admin-key': { type: 'string' },
    'codes': { type: 'string' },
    'proxy': { type: 'boolean', default: false },
  },
})

const outputDir = values['output-dir'] ?? 'legal-output'
const pisteClientId = values['piste-client-id']
const pisteClientSecret = values['piste-client-secret']
const apiUrl = values['api-url'] ?? 'https://studieskit.com'
const authToken = values['auth-token']
const adminKey = values['admin-key']
const useProxy = values['proxy'] ?? false
const codesFilter = values['codes']?.split(',').map(c => c.trim().toLowerCase())

if (!useProxy && (!pisteClientId || !pisteClientSecret)) {
  console.error('Usage:\n  Proxy mode:  npx tsx scripts/ingest-legal-codes.ts --proxy --auth-token <token> [--codes "Code civil"]\n  Direct mode: npx tsx scripts/ingest-legal-codes.ts --piste-client-id <id> --piste-client-secret <secret> [--auth-token <token>]')
  process.exit(1)
}

if (useProxy && !adminKey && !authToken) {
  console.error('Proxy mode requires --admin-key or --auth-token')
  process.exit(1)
}

// ─── API calls (proxy or direct PISTE) ──────────────────

const PISTE_OAUTH_URL = 'https://oauth.piste.gouv.fr/api/oauth/token'
const LEGIFRANCE_BASE = 'https://api.piste.gouv.fr/dila/legifrance/lf-engine-app'
const ADMIN_CRAWL_URL = `${apiUrl}/api/admin/legifrance-crawl`

let pisteToken: { token: string; expiresAt: number } | null = null

async function getPisteToken(): Promise<string> {
  if (pisteToken && pisteToken.expiresAt > Date.now() + 60_000) {
    return pisteToken.token
  }
  const res = await fetch(PISTE_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: pisteClientId!,
      client_secret: pisteClientSecret!,
      scope: 'openid',
    }),
  })
  if (!res.ok) throw new Error(`PISTE OAuth failed: ${res.status} ${await res.text()}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  pisteToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

async function pisteCallDirect(path: string, body: unknown): Promise<unknown> {
  const token = await getPisteToken()
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

async function adminCrawlCall(action: string, params: Record<string, unknown>): Promise<unknown> {
  const authHeader = adminKey ? `ApiKey ${adminKey}` : `Bearer ${authToken}`
  const res = await fetch(ADMIN_CRAWL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({ action, ...params }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Admin crawl ${action}: ${res.status} ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function legifranceCall(action: string, params: Record<string, unknown>): Promise<unknown> {
  if (useProxy) {
    return adminCrawlCall(action, params)
  }
  // Map actions to direct PISTE paths
  switch (action) {
    case 'listCodes': return pisteCallDirect('/list/code', { date: null })
    case 'getTableMatieres': return pisteCallDirect('/consult/code/tableMatieres', params)
    case 'getArticle': return pisteCallDirect('/consult/getArticle', params)
    default: throw new Error(`Unknown action: ${action}`)
  }
}

// ─── Helpers ────────────────────────────────────────────

function stripHtml(html: string): string {
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ─── Types ──────────────────────────────────────────────

interface CodeEntry {
  textId: string
  title: string
  etat: string
}

interface ArticleInfo {
  articleId: string
  num: string
  breadcrumb: string[]
  etat: string
}

interface FetchedArticle extends ArticleInfo {
  text: string
  wordCount: number
}

interface VectorEntry {
  id: string
  values: number[]
  metadata: {
    num: string
    codeName: string
    breadcrumb: string
    text: string
  }
}

// ─── Step 1: List all codes ─────────────────────────────

// Hardcoded list of key French legal codes with their LEGITEXT IDs.
// The PISTE list/code endpoint is unreliable (503), so we maintain this list manually.
// IDs from: https://www.legifrance.gouv.fr/liste/code?etatTexte=VIGUEUR
const KNOWN_CODES: CodeEntry[] = [
  // Priority 1 — Core CRFPA codes
  { textId: 'LEGITEXT000006070721', title: 'Code civil', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006070716', title: 'Code de procédure civile', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006070719', title: 'Code pénal', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006071154', title: 'Code de procédure pénale', etat: 'VIGUEUR' },
  // Priority 2 — Specialty codes
  { textId: 'LEGITEXT000005634379', title: 'Code de commerce', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006072050', title: 'Code du travail', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006069577', title: 'Code général des impôts', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006069414', title: 'Code de la propriété intellectuelle', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006074096', title: 'Code de la consommation', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006074075', title: 'Code de la construction et de l\'habitation', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006070933', title: 'Code de justice administrative', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006074220', title: 'Code de l\'environnement', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006074069', title: 'Code de l\'urbanisme', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006073189', title: 'Code de la sécurité sociale', etat: 'VIGUEUR' },
  { textId: 'LEGITEXT000006071191', title: 'Code de l\'entrée et du séjour des étrangers', etat: 'VIGUEUR' },
]

async function listCodes(): Promise<CodeEntry[]> {
  // Try the API first, fall back to hardcoded list
  try {
    console.log('Trying PISTE list/code endpoint...')
    const data = await legifranceCall('listCodes', {}) as Record<string, unknown>
    const results = (data.results ?? data.codes ?? data.textList ?? []) as Array<Record<string, string>>
    if (Array.isArray(results) && results.length > 10) {
      console.log(`Got ${results.length} codes from API`)
      return results
        .filter(c => (c.etat ?? '') !== 'ABROGE')
        .map(c => ({ textId: c.id ?? c.textId ?? '', title: c.titre ?? c.title ?? '', etat: c.etat ?? 'VIGUEUR' }))
        .filter(c => c.textId)
    }
  } catch (e) {
    console.log(`list/code failed (${(e as Error).message}), using hardcoded list`)
  }
  console.log(`Using hardcoded list of ${KNOWN_CODES.length} codes`)
  return KNOWN_CODES
}

// ─── Step 2: Fetch table of contents ────────────────────

function extractArticles(
  sections: unknown[],
  breadcrumb: string[] = [],
): ArticleInfo[] {
  const articles: ArticleInfo[] = []

  for (const section of sections) {
    const s = section as Record<string, unknown>
    const title = typeof s.title === 'string'
      ? s.title.replace(/<[^>]+>/g, '').trim()
      : (typeof s.titre === 'string' ? s.titre.replace(/<[^>]+>/g, '').trim() : '')
    const currentBreadcrumb = title ? [...breadcrumb, title] : breadcrumb

    // Extract articles at this level
    const arts = (s.articles ?? s.extractsArticle ?? []) as Array<Record<string, string>>
    for (const art of arts) {
      const id = art.id ?? art.cid ?? ''
      const num = art.num ?? ''
      const etat = art.etat ?? art.legalStatus ?? ''
      if (id && etat !== 'ABROGE') {
        articles.push({ articleId: id, num, breadcrumb: currentBreadcrumb, etat })
      }
    }

    // Recurse into child sections
    const children = (s.sections ?? s.children ?? []) as unknown[]
    if (Array.isArray(children) && children.length > 0) {
      articles.push(...extractArticles(children, currentBreadcrumb))
    }
  }

  return articles
}

async function fetchTableOfContents(textId: string): Promise<ArticleInfo[]> {
  const data = await legifranceCall('getTableMatieres', {
    textId,
    date: new Date().toISOString().slice(0, 10),
  }) as Record<string, unknown>

  const sections = (data.sections ?? data.children ?? data.tableMatieres ?? []) as unknown[]
  return extractArticles(Array.isArray(sections) ? sections : [])
}

// ─── Step 3: Fetch articles ─────────────────────────────

async function fetchArticle(articleId: string): Promise<{ num: string; text: string; etat: string } | null> {
  try {
    const data = await legifranceCall('getArticle', { id: articleId }) as Record<string, unknown>
    const article = (data.article ?? data) as Record<string, string>
    const html = article.texteHtml ?? article.texte ?? article.content ?? ''
    if (!html) return null
    const text = stripHtml(html)
    return { num: article.num ?? '', text, etat: article.etat ?? 'VIGUEUR' }
  } catch {
    return null
  }
}

async function fetchArticlesBatch(
  articles: ArticleInfo[],
  concurrency: number,
  delayMs: number,
): Promise<FetchedArticle[]> {
  const results: FetchedArticle[] = []
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency)
    const fetched = await Promise.all(batch.map(async (art) => {
      const result = await fetchArticle(art.articleId)
      if (!result || result.etat === 'ABROGE' || !result.text.trim()) return null
      return {
        ...art,
        num: result.num || art.num,
        text: result.text,
        wordCount: result.text.split(/\s+/).length,
      }
    }))
    results.push(...fetched.filter((r): r is FetchedArticle => r !== null))
    if (i + concurrency < articles.length) await sleep(delayMs)
  }
  return results
}

// ─── Step 4: Chunk articles ─────────────────────────────

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

function chunkArticles(articles: FetchedArticle[], codeName: string, codeSlug: string): Chunk[] {
  const chunks: Chunk[] = []
  let i = 0

  while (i < articles.length) {
    const art = articles[i]
    const breadcrumb = art.breadcrumb.join(' > ')

    if (art.wordCount > 400) {
      // Split long article at paragraph breaks
      const paragraphs = art.text.split(/\n\n+/).filter(p => p.trim())
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
    } else if (art.wordCount < 50) {
      // Group short articles together
      let grouped = `Art. ${art.num} — ${art.text}`
      let totalWords = art.wordCount
      const nums = [art.num]
      let j = i + 1
      while (j < articles.length && totalWords < 100) {
        const next = articles[j]
        if (next.wordCount > 100) break // don't group with a longer article
        grouped += `\n\nArt. ${next.num} — ${next.text}`
        totalWords += next.wordCount
        nums.push(next.num)
        j++
      }
      chunks.push({
        id: `${codeSlug}-art-${slugify(nums[0])}`,
        codeName,
        num: nums.join(', '),
        breadcrumb,
        text: grouped,
      })
      i = j
      continue
    } else {
      // Normal article — one chunk
      chunks.push({
        id: `${codeSlug}-art-${slugify(art.num)}`,
        codeName,
        num: art.num,
        breadcrumb,
        text: `Art. ${art.num} — ${art.text}`,
      })
    }
    i++
  }

  return chunks
}

// ─── Step 5: Generate embeddings ────────────────────────

async function generateEmbeddings(texts: string[], _token: string): Promise<number[][]> {
  const BATCH = 50
  const all: number[][] = []
  // Use admin endpoint if available (no rate limit), else fall back to /api/embed
  const embedUrl = adminKey ? ADMIN_CRAWL_URL : `${apiUrl}/api/embed`
  const embedAuth = adminKey ? `ApiKey ${adminKey}` : `Bearer ${_token}`

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map(t => t.slice(0, 8192))
    const body = adminKey ? { action: 'embed', texts: batch } : { texts: batch }
    const res = await fetch(embedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: embedAuth },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Embed API failed: ${res.status} ${err}`)
    }
    const data = await res.json() as { embeddings: string[] }

    // Decode base64 embeddings to number arrays
    for (const b64 of data.embeddings) {
      const binary = Buffer.from(b64, 'base64')
      const floats = new Float32Array(binary.buffer, binary.byteOffset, binary.byteLength / 4)
      all.push(Array.from(floats))
    }

    if (i + BATCH < texts.length) {
      process.stdout.write(`  Embedded ${Math.min(i + BATCH, texts.length)}/${texts.length}\r`)
      await sleep(1000)
    }
  }
  console.log(`  Embedded ${texts.length}/${texts.length}`)
  return all
}

// ─── Step 6: Write NDJSON for Vectorize ─────────────────

function writeVectorBatches(vectors: VectorEntry[], dir: string): number {
  const MAX_PER_FILE = 5000
  let fileIndex = 0
  for (let i = 0; i < vectors.length; i += MAX_PER_FILE) {
    const batch = vectors.slice(i, i + MAX_PER_FILE)
    const lines = batch.map(v => JSON.stringify(v)).join('\n')
    writeFileSync(join(dir, `batch-${String(fileIndex).padStart(3, '0')}.ndjson`), lines + '\n')
    fileIndex++
  }
  return fileIndex
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log('=== French Legal Codes Ingestion ===\n')

  mkdirSync(join(outputDir, 'cache'), { recursive: true })
  mkdirSync(join(outputDir, 'vectors'), { recursive: true })

  // Step 1: List codes
  const allCodes = await listCodes()
  console.log(`Found ${allCodes.length} codes in force`)

  const codes = codesFilter
    ? allCodes.filter(c => codesFilter.some(f => c.title.toLowerCase().includes(f)))
    : allCodes

  if (codesFilter) {
    console.log(`Filtered to ${codes.length} codes: ${codes.map(c => c.title).join(', ')}`)
  }

  let totalArticles = 0
  let totalChunks = 0
  let totalVectorsWritten = 0
  let embeddingsFailed = false

  for (let ci = 0; ci < codes.length; ci++) {
    const code = codes[ci]
    const codeSlug = slugify(code.title)
    const cachePath = join(outputDir, 'cache', `${codeSlug}.json`)
    const vectorPath = join(outputDir, 'vectors', `${codeSlug}.ndjson`)

    console.log(`\n[${ci + 1}/${codes.length}] ${code.title} (${code.textId})`)

    // Skip if vectors already generated for this code
    if (existsSync(vectorPath)) {
      const lines = readFileSync(vectorPath, 'utf-8').trim().split('\n').length
      console.log(`  ✓ Vectors already generated (${lines} vectors)`)
      totalVectorsWritten += lines
      // Still count articles/chunks from cache
      if (existsSync(cachePath)) {
        const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as FetchedArticle[]
        totalArticles += cached.length
        totalChunks += chunkArticles(cached, code.title, codeSlug).length
      }
      continue
    }

    // Check cache for resume
    let fetchedArticles: FetchedArticle[]
    if (existsSync(cachePath)) {
      console.log('  Using cached articles')
      fetchedArticles = JSON.parse(readFileSync(cachePath, 'utf-8'))
    } else {
      // Fetch table of contents
      console.log('  Fetching table of contents...')
      let articleInfos: ArticleInfo[]
      try {
        articleInfos = await fetchTableOfContents(code.textId)
      } catch (err) {
        console.error(`  ✗ Failed to fetch TOC: ${err}`)
        continue
      }
      console.log(`  Found ${articleInfos.length} articles in TOC`)

      if (articleInfos.length === 0) {
        console.log('  ⚠ No articles found, skipping')
        continue
      }

      // Fetch article text
      console.log(`  Fetching article text (${articleInfos.length} articles)...`)
      fetchedArticles = await fetchArticlesBatch(articleInfos, 10, 200)
      console.log(`  Fetched ${fetchedArticles.length}/${articleInfos.length} articles`)

      // Cache
      writeFileSync(cachePath, JSON.stringify(fetchedArticles))
    }

    totalArticles += fetchedArticles.length

    // Chunk
    const chunks = chunkArticles(fetchedArticles, code.title, codeSlug)
    console.log(`  Chunks: ${chunks.length}`)
    totalChunks += chunks.length

    // Generate embeddings per-code (incremental)
    if ((authToken || adminKey) && !embeddingsFailed) {
      console.log(`  Embedding ${chunks.length} chunks...`)
      const texts = chunks.map(c => `${c.codeName} > ${c.breadcrumb} > Article ${c.num}\n${c.text}`)

      try {
        const embeddings = await generateEmbeddings(texts, authToken ?? '')
        const vectors: VectorEntry[] = chunks.map((chunk, i) => ({
          id: chunk.id,
          values: embeddings[i],
          metadata: {
            num: chunk.num,
            codeName: chunk.codeName,
            breadcrumb: chunk.breadcrumb,
            text: chunk.text.slice(0, 9500),
          },
        }))

        // Write NDJSON for this code
        const lines = vectors.map(v => JSON.stringify(v)).join('\n')
        writeFileSync(vectorPath, lines + '\n')
        totalVectorsWritten += vectors.length
        console.log(`  ✓ Wrote ${vectors.length} vectors to ${codeSlug}.ndjson`)
      } catch (err) {
        console.error(`  ✗ Embedding failed: ${(err as Error).message?.slice(0, 200)}`)
        console.log('  Stopping embeddings — re-run tomorrow to continue (free tier resets daily)')
        embeddingsFailed = true
      }
    }

    await sleep(500)
  }

  console.log(`\n=== Totals ===`)
  console.log(`Articles: ${totalArticles}`)
  console.log(`Chunks: ${totalChunks}`)
  console.log(`Vectors written: ${totalVectorsWritten}`)
  if (totalVectorsWritten < totalChunks) {
    console.log(`⚠ ${totalChunks - totalVectorsWritten} chunks still need embeddings — re-run tomorrow`)
  }

  // Write summary stats
  const stats = {
    codes: codes.map(c => ({ title: c.title, textId: c.textId })),
    totalArticles,
    totalChunks,
    totalVectorsWritten,
    generatedAt: new Date().toISOString(),
  }
  writeFileSync(join(outputDir, 'stats.json'), JSON.stringify(stats, null, 2))

  console.log(`\nDone! Stats written to ${outputDir}/stats.json`)
  console.log(`\nTo upload vectors to Vectorize:`)
  console.log(`  for f in ${outputDir}/vectors/batch-*.ndjson; do`)
  console.log(`    wrangler vectorize insert legal-codes --file="$f"`)
  console.log(`  done`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
