const { PDFParse } = require('pdf-parse')
const fs = require('fs')
const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [
  '/tmp/crfpa-rapports/crfparapport-de-la-commission-nationale-2025-69a7f281caf229.08205902.pdf',
  '/tmp/crfpa-rapports/crfparapport-de-la-commission-nationale-2023-2024-69a7f418c4bfc9.54285126.pdf',
]
;(async () => {
for (const f of files) {
  const buf = fs.readFileSync(f)
  const parser = new PDFParse({ data: buf })
  const data = await parser.getText()
  console.log('====', f.split('/').pop(), '====')
  console.log('pages:', data.pages?.length, 'total text len:', data.text?.length)
  console.log('FIRST 4000 CHARS:')
  console.log((data.text || '').slice(0, 4000))
  console.log('')
}
})()
