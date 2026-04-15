#!/usr/bin/env npx tsx
/**
 * Embed any chunks JSON file with E5-large and produce Vectorize NDJSON.
 *
 * Usage:
 *   npx tsx scripts/embed-sources.ts --input legal-sources-output/all-sources-chunks.json --output-dir legal-sources-output
 */
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseArgs } from 'util'
import { pipeline } from '@huggingface/transformers'

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    'output-dir': { type: 'string', default: 'legal-sources-output' },
  },
})

const inputFile = values.input
const outputDir = values['output-dir'] ?? 'legal-sources-output'

if (!inputFile) {
  console.error('Usage: npx tsx scripts/embed-sources.ts --input <chunks.json> --output-dir <dir>')
  process.exit(1)
}

interface Chunk {
  id: string
  codeName: string
  num: string
  breadcrumb: string
  text: string
}

async function main() {
  console.log('=== Embed Sources with E5-large ===\n')
  console.log('Loading model...')
  const embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-large', { dtype: 'fp32' })
  console.log('Model loaded.\n')

  const chunks = JSON.parse(readFileSync(inputFile!, 'utf-8')) as Chunk[]
  console.log(`${chunks.length} chunks to embed\n`)

  const BATCH = 32
  const lines: string[] = []

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH)
    const texts = batch.map(c => `query: ${c.codeName} > ${c.breadcrumb}\n${c.text}`.slice(0, 512))

    const outputs = await embedder(texts, { pooling: 'cls', normalize: true })
    const vectors = outputs.tolist() as number[][]

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      // Truncate metadata text to fit 10KB limit
      let metaText = chunk.text
      const metaJson = JSON.stringify({ num: chunk.num, codeName: chunk.codeName, breadcrumb: chunk.breadcrumb, text: metaText })
      while (new TextEncoder().encode(metaJson).length > 10200) {
        metaText = metaText.slice(0, metaText.length - 200) + '...'
      }

      // Ensure ID is ≤64 bytes
      let id = chunk.id
      if (new TextEncoder().encode(id).length > 64) {
        const { createHash } = await import('crypto')
        const h = createHash('md5').update(id).digest('hex').slice(0, 8)
        id = id.slice(0, 55) + '-' + h
      }

      lines.push(JSON.stringify({
        id,
        values: vectors[j],
        metadata: { num: chunk.num, codeName: chunk.codeName, breadcrumb: chunk.breadcrumb, text: metaText },
      }))
    }

    if ((i + BATCH) % 320 === 0 || i + BATCH >= chunks.length) {
      process.stdout.write(`  ${Math.min(i + BATCH, chunks.length)}/${chunks.length}\r`)
    }
  }

  // Write NDJSON files (max 5000 per file)
  let fileIndex = 0
  for (let i = 0; i < lines.length; i += 5000) {
    const batch = lines.slice(i, i + 5000)
    writeFileSync(join(outputDir, 'vectors', `sources-batch-${String(fileIndex).padStart(3, '0')}.ndjson`), batch.join('\n') + '\n')
    fileIndex++
  }

  console.log(`\n\n✓ ${lines.length} vectors in ${fileIndex} files`)
  console.log(`\nTo upload to Vectorize:`)
  console.log(`  for f in ${outputDir}/vectors/sources-batch-*.ndjson; do`)
  console.log(`    wrangler vectorize insert legal-codes --file="$f"`)
  console.log(`  done`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
