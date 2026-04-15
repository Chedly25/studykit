#!/usr/bin/env npx tsx
/**
 * Test legal search locally: embed query with local BGE model, query Vectorize via REST API.
 */
import { pipeline } from '@huggingface/transformers'

const query = process.argv[2] ?? 'conditions de validité d un contrat'
console.log(`Query: "${query}"\n`)

console.log('Loading BGE model...')
const embedder = await pipeline('feature-extraction', 'Xenova/bge-m3', { dtype: 'fp32' })

console.log('Embedding query...')
const output = await embedder(query, { pooling: 'cls', normalize: true })
const vec = output.tolist()[0] as number[]
console.log(`Vector: ${vec.length} dimensions`)

// Query Vectorize via REST API
const ACCOUNT_ID = 'dd9aae3598da0d9e82be83347e14be83'
const INDEX_NAME = 'legal-codes'

// Get API token from wrangler's stored auth
const { execSync } = await import('child_process')
let apiToken = ''
try {
  // wrangler stores the OAuth token — we can extract it
  const whoami = execSync('wrangler whoami 2>&1', { encoding: 'utf-8' })
  // Use wrangler's config to get the token
  const configDir = process.env.HOME + '/.wrangler/config'
  const { readFileSync, existsSync } = await import('fs')

  // Try to find the token in wrangler's config
  for (const path of [
    process.env.HOME + '/.wrangler/config/default.toml',
    process.env.HOME + '/.config/.wrangler/config/default.toml',
  ]) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8')
      const match = content.match(/oauth_token\s*=\s*"([^"]+)"/)
      if (match) { apiToken = match[1]; break }
    }
  }
} catch {}

if (!apiToken) {
  // Fallback: use CF_API_TOKEN env var
  apiToken = process.env.CF_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN ?? ''
}

if (!apiToken) {
  console.log('\nCannot find Cloudflare API token. Using wrangler CLI fallback...')
  // Write vector to file and use wrangler vectorize query with --vector-file
  const { writeFileSync } = await import('fs')
  const ndjson = JSON.stringify({ vector: vec, topK: 5, returnMetadata: 'all' })
  writeFileSync('/tmp/vq.ndjson', ndjson)

  try {
    const result = execSync(
      `curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${INDEX_NAME}/query" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Authorization: Bearer $(grep -o 'oauth_token = "[^"]*"' ~/.wrangler/config/default.toml 2>/dev/null | cut -d'"' -f2 || echo '')" ` +
      `-d '${JSON.stringify({ vector: vec, topK: 5, returnMetadata: "all" })}'`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 }
    )
    const data = JSON.parse(result)
    if (data.result?.matches) {
      console.log(`\nFound ${data.result.matches.length} results:\n`)
      for (const m of data.result.matches) {
        const meta = m.metadata ?? {}
        console.log(`  ${meta.codeName}, Art. ${meta.num} (score: ${m.score?.toFixed(3)})`)
        console.log(`  ${(meta.text ?? '').slice(0, 150)}...\n`)
      }
    } else {
      console.log('Response:', JSON.stringify(data).slice(0, 500))
    }
  } catch (e) {
    console.error('Failed:', (e as Error).message?.slice(0, 200))
  }
  process.exit(0)
}

console.log('\nQuerying Vectorize...')
const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${INDEX_NAME}/query`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ vector: vec, topK: 5, returnMetadata: 'all' }),
  }
)

const data = await res.json() as { result?: { matches?: Array<{ score: number; metadata?: Record<string, string> }> } }
const matches = data.result?.matches ?? []

console.log(`\nFound ${matches.length} results:\n`)
for (const m of matches) {
  const meta = m.metadata ?? {}
  console.log(`  ${meta.codeName}, Art. ${meta.num} (score: ${m.score?.toFixed(3)})`)
  console.log(`  ${(meta.text ?? '').slice(0, 150)}...\n`)
}
