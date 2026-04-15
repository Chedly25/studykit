#!/usr/bin/env npx tsx
/**
 * Generate embeddings locally for legal code chunks using BGE-base via transformers.js.
 * No API calls, no rate limits. Reads cached articles from legal-output/cache/.
 *
 * Usage:
 *   npx tsx scripts/embed-legal-codes.ts [--output-dir legal-output]
 */
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { pipeline } from '@huggingface/transformers'

const { values } = parseArgs({
  options: { 'output-dir': { type: 'string', default: 'legal-output' } },
})
const outputDir = values['output-dir'] ?? 'legal-output'

// ─── Reuse chunking logic from ingest script ───────────

interface FetchedArticle {
  articleId: string; num: string; breadcrumb: string[]; etat: string; text: string; wordCount: number
}
interface Chunk { id: string; codeName: string; num: string; breadcrumb: string; text: string }

function slugify(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function chunkArticles(articles: FetchedArticle[], codeName: string, codeSlug: string): Chunk[] {
  const chunks: Chunk[] = []
  let i = 0
  while (i < articles.length) {
    const art = articles[i]
    const breadcrumb = art.breadcrumb.join(' > ')
    if (art.wordCount > 400) {
      const paragraphs = art.text.split(/\n\n+/).filter(p => p.trim())
      let buffer = '', partIndex = 0
      for (const para of paragraphs) {
        const combined = buffer ? `${buffer}\n\n${para}` : para
        if (combined.split(/\s+/).length > 400 && buffer) {
          chunks.push({ id: `${codeSlug}-art-${slugify(art.num)}-p${partIndex}`, codeName, num: art.num, breadcrumb, text: `Art. ${art.num} — ${buffer}` })
          partIndex++; buffer = para
        } else { buffer = combined }
      }
      if (buffer) chunks.push({ id: `${codeSlug}-art-${slugify(art.num)}${partIndex > 0 ? `-p${partIndex}` : ''}`, codeName, num: art.num, breadcrumb, text: `Art. ${art.num} — ${buffer}` })
    } else if (art.wordCount < 50) {
      let grouped = `Art. ${art.num} — ${art.text}`, totalWords = art.wordCount
      const nums = [art.num]; let j = i + 1
      while (j < articles.length && totalWords < 100) {
        const next = articles[j]
        if (next.wordCount > 100) break
        grouped += `\n\nArt. ${next.num} — ${next.text}`; totalWords += next.wordCount; nums.push(next.num); j++
      }
      chunks.push({ id: `${codeSlug}-art-${slugify(nums[0])}`, codeName, num: nums.join(', '), breadcrumb, text: grouped })
      i = j; continue
    } else {
      chunks.push({ id: `${codeSlug}-art-${slugify(art.num)}`, codeName, num: art.num, breadcrumb, text: `Art. ${art.num} — ${art.text}` })
    }
    i++
  }
  return chunks
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log('=== Local Embedding Generation ===\n')
  console.log('Loading BGE-base model (first run downloads ~130MB)...')

  const embedder = await pipeline('feature-extraction', 'Xenova/bge-m3', {
    dtype: 'fp32',
  })
  console.log('Model loaded.\n')

  const cacheDir = join(outputDir, 'cache')
  const vectorDir = join(outputDir, 'vectors')

  const cacheFiles = readdirSync(cacheDir).filter(f => f.endsWith('.json'))
  let totalVectors = 0

  for (const file of cacheFiles) {
    const codeSlug = file.replace('.json', '')
    const vectorPath = join(vectorDir, `${codeSlug}.ndjson`)

    // Skip if already done
    if (existsSync(vectorPath)) {
      const count = readFileSync(vectorPath, 'utf-8').trim().split('\n').length
      console.log(`✓ ${codeSlug}: already done (${count} vectors)`)
      totalVectors += count
      continue
    }

    const articles = JSON.parse(readFileSync(join(cacheDir, file), 'utf-8')) as FetchedArticle[]
    // Reconstruct code name from first article or slug
    const codeName = articles[0]?.breadcrumb?.[0] ?? codeSlug.replace(/-/g, ' ')
    const chunks = chunkArticles(articles, codeName, codeSlug)

    console.log(`Embedding ${codeSlug}: ${chunks.length} chunks...`)
    const BATCH = 32
    const lines: string[] = []

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)
      const texts = batch.map(c => `${c.codeName} > ${c.breadcrumb} > Article ${c.num}\n${c.text}`.slice(0, 512))

      const outputs = await embedder(texts, { pooling: 'cls', normalize: true })
      // outputs.tolist() returns number[][]
      const vectors = outputs.tolist() as number[][]

      for (let j = 0; j < batch.length; j++) {
        lines.push(JSON.stringify({
          id: batch[j].id,
          values: vectors[j],
          metadata: {
            num: batch[j].num,
            codeName: batch[j].codeName,
            breadcrumb: batch[j].breadcrumb,
            text: batch[j].text.slice(0, 9500),
          },
        }))
      }

      if ((i + BATCH) % 320 === 0 || i + BATCH >= chunks.length) {
        process.stdout.write(`  ${Math.min(i + BATCH, chunks.length)}/${chunks.length}\r`)
      }
    }

    writeFileSync(vectorPath, lines.join('\n') + '\n')
    totalVectors += lines.length
    console.log(`  ✓ ${lines.length} vectors → ${codeSlug}.ndjson`)
  }

  console.log(`\n=== Done! ${totalVectors} total vectors ===`)
  console.log(`\nTo upload to Vectorize:`)
  console.log(`  for f in ${vectorDir}/*.ndjson; do`)
  console.log(`    wrangler vectorize insert legal-codes --file="$f"`)
  console.log(`  done`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
