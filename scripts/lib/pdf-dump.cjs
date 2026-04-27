const { PDFParse } = require('pdf-parse')
const fs = require('fs')
const file = process.argv[2]
;(async () => {
  const buf = fs.readFileSync(file)
  const parser = new PDFParse({ data: buf })
  const data = await parser.getText()
  console.log(data.text || '')
})()
