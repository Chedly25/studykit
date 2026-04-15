#!/usr/bin/env npx tsx
/**
 * Re-embed all library docs (CPGE, etc.) with BGE-M3 (1024-dim).
 * Reads existing JSON packages, generates embeddings, writes them back.
 *
 * Usage: npx tsx scripts/embed-library.ts [--dir library-output]
 */
import { writeFileSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { pipeline } from '@huggingface/transformers'

const { values } = parseArgs({
  options: { dir: { type: 'string', default: 'library-output' } },
})
const dir = values.dir ?? 'library-output'
const docsDir = join(dir, 'docs')

async function main() {
  console.log('=== Re-embed Library with BGE-M3 ===\n')
  console.log('Loading BGE-M3 model...')
  const embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-large', { dtype: 'fp32' })
  console.log('Model loaded.\n')

  const files = readdirSync(docsDir).filter(f => f.endsWith('.json'))
  console.log(`Found ${files.length} document packages\n`)

  let totalChunks = 0
  let totalEmbedded = 0
  const BATCH = 32

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi]
    const filePath = join(docsDir, file)
    const pkg = JSON.parse(readFileSync(filePath, 'utf-8'))
    const chunks = pkg.chunks ?? []

    if (chunks.length === 0) continue
    totalChunks += chunks.length

    process.stdout.write(`[${fi + 1}/${files.length}] ${file} (${chunks.length} chunks)... `)

    const embeddings: Array<{ id: string; chunkId: string; documentId: string; embedding: string }> = []

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)
      const texts = batch.map((c: { content: string; contextPrefix?: string }) => {
        const prefix = c.contextPrefix ? `${c.contextPrefix}\n` : ''
        return (prefix + c.content).slice(0, 512)
      })

      const outputs = await embedder(texts, { pooling: 'cls', normalize: true })
      const vectors = outputs.tolist() as number[][]

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]
        // Encode as base64 Float32Array (same format as existing pipeline)
        const f32 = new Float32Array(vectors[j])
        const bytes = new Uint8Array(f32.buffer)
        let binary = ''
        for (let k = 0; k < bytes.length; k++) binary += String.fromCharCode(bytes[k])
        const b64 = btoa(binary)

        embeddings.push({
          id: `${chunk.documentId}-emb-${String(chunk.chunkIndex).padStart(4, '0')}`,
          chunkId: chunk.id,
          documentId: chunk.documentId,
          embedding: b64,
        })
      }
    }

    // Write updated package with embeddings
    pkg.embeddings = embeddings
    writeFileSync(filePath, JSON.stringify(pkg))
    totalEmbedded += embeddings.length
    console.log(`✓ ${embeddings.length} embeddings`)
  }

  console.log(`\n=== Done! ${totalEmbedded} embeddings across ${files.length} docs (${totalChunks} chunks) ===`)
  console.log(`\nTo upload to R2:`)
  console.log(`  wrangler r2 object put studykit-library/library/cpge-mp/manifest.json --file ${dir}/manifest.json`)
  console.log(`  for f in ${docsDir}/*.json; do`)
  console.log(`    wrangler r2 object put "studykit-library/library/cpge-mp/docs/$(basename $f)" --file "$f"`)
  console.log(`  done`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
