import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('citation-generator')!

type SourceType = 'book' | 'website' | 'journal' | 'video'
type CitationFormat = 'apa' | 'mla' | 'chicago' | 'harvard'

interface BookFields {
  author: string
  title: string
  publisher: string
  year: string
  edition: string
  pages: string
}

interface WebsiteFields {
  author: string
  pageTitle: string
  siteName: string
  url: string
  accessDate: string
}

interface JournalFields {
  author: string
  articleTitle: string
  journalName: string
  volume: string
  issue: string
  year: string
  pages: string
}

interface VideoFields {
  creator: string
  title: string
  platform: string
  url: string
  date: string
}

type FieldsMap = {
  book: BookFields
  website: WebsiteFields
  journal: JournalFields
  video: VideoFields
}

const initialFields: FieldsMap = {
  book: { author: '', title: '', publisher: '', year: '', edition: '', pages: '' },
  website: { author: '', pageTitle: '', siteName: '', url: '', accessDate: '' },
  journal: { author: '', articleTitle: '', journalName: '', volume: '', issue: '', year: '', pages: '' },
  video: { creator: '', title: '', platform: '', url: '', date: '' },
}

function formatAPA(type: SourceType, fields: FieldsMap): string {
  switch (type) {
    case 'book': {
      const { author, title, publisher, year, edition, pages } = fields.book
      const editionStr = edition ? ` (${edition} ed.)` : ''
      const pagesStr = pages ? `, pp. ${pages}` : ''
      return `${author} (${year}). *${title}*${editionStr}. ${publisher}${pagesStr}.`
    }
    case 'website': {
      const { author, pageTitle, siteName, url, accessDate } = fields.website
      const authorStr = author || siteName
      return `${authorStr}. (${accessDate}). ${pageTitle}. *${siteName}*. ${url}`
    }
    case 'journal': {
      const { author, articleTitle, journalName, volume, issue, year, pages } = fields.journal
      return `${author} (${year}). ${articleTitle}. *${journalName}*, *${volume}*(${issue}), ${pages}.`
    }
    case 'video': {
      const { creator, title, platform, url, date } = fields.video
      return `${creator} (${date}). *${title}* [Video]. ${platform}. ${url}`
    }
  }
}

function formatMLA(type: SourceType, fields: FieldsMap): string {
  switch (type) {
    case 'book': {
      const { author, title, publisher, year, edition } = fields.book
      const editionStr = edition ? ` ${edition} ed.,` : ''
      return `${author}. *${title}*.${editionStr} ${publisher}, ${year}.`
    }
    case 'website': {
      const { author, pageTitle, siteName, url, accessDate } = fields.website
      const authorStr = author || ''
      return `${authorStr}${authorStr ? '. ' : ''}"${pageTitle}." *${siteName}*, ${url}. Accessed ${accessDate}.`
    }
    case 'journal': {
      const { author, articleTitle, journalName, volume, issue, year, pages } = fields.journal
      return `${author}. "${articleTitle}." *${journalName}*, vol. ${volume}, no. ${issue}, ${year}, pp. ${pages}.`
    }
    case 'video': {
      const { creator, title, platform, url, date } = fields.video
      return `${creator}. "${title}." *${platform}*, ${date}, ${url}.`
    }
  }
}

function formatChicago(type: SourceType, fields: FieldsMap): string {
  switch (type) {
    case 'book': {
      const { author, title, publisher, year } = fields.book
      return `${author}. *${title}*. ${publisher}, ${year}.`
    }
    case 'website': {
      const { author, pageTitle, siteName, url, accessDate } = fields.website
      const authorStr = author || siteName
      return `${authorStr}. "${pageTitle}." ${siteName}. Accessed ${accessDate}. ${url}.`
    }
    case 'journal': {
      const { author, articleTitle, journalName, volume, issue, year, pages } = fields.journal
      return `${author}. "${articleTitle}." *${journalName}* ${volume}, no. ${issue} (${year}): ${pages}.`
    }
    case 'video': {
      const { creator, title, platform, url, date } = fields.video
      return `${creator}. "${title}." ${platform}. ${date}. ${url}.`
    }
  }
}

function formatHarvard(type: SourceType, fields: FieldsMap): string {
  switch (type) {
    case 'book': {
      const { author, title, publisher, year, edition } = fields.book
      const editionStr = edition ? ` ${edition} edn.` : ''
      return `${author} (${year}) *${title}*.${editionStr} ${publisher}.`
    }
    case 'website': {
      const { author, pageTitle, siteName, url, accessDate } = fields.website
      const authorStr = author || siteName
      return `${authorStr} (${accessDate}) '${pageTitle}', *${siteName}*. Available at: ${url} (Accessed: ${accessDate}).`
    }
    case 'journal': {
      const { author, articleTitle, journalName, volume, issue, year, pages } = fields.journal
      return `${author} (${year}) '${articleTitle}', *${journalName}*, ${volume}(${issue}), pp. ${pages}.`
    }
    case 'video': {
      const { creator, title, platform, url, date } = fields.video
      return `${creator} (${date}) *${title}*. ${platform}. Available at: ${url}.`
    }
  }
}

function generateCitation(format: CitationFormat, type: SourceType, fields: FieldsMap): string {
  switch (format) {
    case 'apa': return formatAPA(type, fields)
    case 'mla': return formatMLA(type, fields)
    case 'chicago': return formatChicago(type, fields)
    case 'harvard': return formatHarvard(type, fields)
  }
}

interface FieldConfig {
  key: string
  label: string
  placeholder: string
  optional?: boolean
}

const fieldConfigs: Record<SourceType, FieldConfig[]> = {
  book: [
    { key: 'author', label: 'Author(s)', placeholder: 'Last, First M.' },
    { key: 'title', label: 'Title', placeholder: 'Book title' },
    { key: 'publisher', label: 'Publisher', placeholder: 'Publisher name' },
    { key: 'year', label: 'Year', placeholder: '2024' },
    { key: 'edition', label: 'Edition', placeholder: '2nd', optional: true },
    { key: 'pages', label: 'Pages', placeholder: '12-45', optional: true },
  ],
  website: [
    { key: 'author', label: 'Author', placeholder: 'Last, First M.' },
    { key: 'pageTitle', label: 'Page Title', placeholder: 'Title of the page' },
    { key: 'siteName', label: 'Site Name', placeholder: 'Website name' },
    { key: 'url', label: 'URL', placeholder: 'https://...' },
    { key: 'accessDate', label: 'Access Date', placeholder: 'March 15, 2026' },
  ],
  journal: [
    { key: 'author', label: 'Author(s)', placeholder: 'Last, First M.' },
    { key: 'articleTitle', label: 'Article Title', placeholder: 'Title of the article' },
    { key: 'journalName', label: 'Journal Name', placeholder: 'Journal name' },
    { key: 'volume', label: 'Volume', placeholder: '12' },
    { key: 'issue', label: 'Issue', placeholder: '3' },
    { key: 'year', label: 'Year', placeholder: '2024' },
    { key: 'pages', label: 'Pages', placeholder: '45-67' },
  ],
  video: [
    { key: 'creator', label: 'Creator', placeholder: 'Channel or creator name' },
    { key: 'title', label: 'Title', placeholder: 'Video title' },
    { key: 'platform', label: 'Platform', placeholder: 'YouTube' },
    { key: 'url', label: 'URL', placeholder: 'https://...' },
    { key: 'date', label: 'Date', placeholder: 'March 15, 2026' },
  ],
}

export default function CitationGenerator() {
  const [sourceType, setSourceType] = useState<SourceType>('book')
  const [format, setFormat] = useState<CitationFormat>('apa')
  const [fields, setFields] = useState<FieldsMap>({ ...initialFields })
  const [citation, setCitation] = useState('')
  const [copied, setCopied] = useState(false)

  function updateField(type: SourceType, key: string, value: string) {
    setFields(prev => ({
      ...prev,
      [type]: { ...prev[type], [key]: value },
    }))
  }

  function handleGenerate() {
    const result = generateCitation(format, sourceType, fields)
    setCitation(result)
    setCopied(false)
  }

  async function handleCopy() {
    if (!citation) return
    const plain = citation.replace(/\*/g, '')
    await navigator.clipboard.writeText(plain)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSourceTypeChange(newType: SourceType) {
    setSourceType(newType)
    setCitation('')
  }

  return (
    <>
      <ToolSEO
        title={tool.seoTitle}
        description={tool.seoDescription}
        slug={tool.slug}
        keywords={tool.keywords}
      />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        <div className="space-y-6">
          {/* Source Type & Format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1.5">Source Type</label>
              <select
                value={sourceType}
                onChange={e => handleSourceTypeChange(e.target.value as SourceType)}
                className="select-field"
              >
                <option value="book">Book</option>
                <option value="website">Website</option>
                <option value="journal">Journal Article</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-body)] mb-1.5">Citation Format</label>
              <select
                value={format}
                onChange={e => setFormat(e.target.value as CitationFormat)}
                className="select-field"
              >
                <option value="apa">APA 7th</option>
                <option value="mla">MLA 9th</option>
                <option value="chicago">Chicago 17th</option>
                <option value="harvard">Harvard</option>
              </select>
            </div>
          </div>

          {/* Dynamic Fields */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-heading)]">
              Source Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fieldConfigs[sourceType].map(config => (
                <div key={config.key}>
                  <label className="block text-sm font-medium text-[var(--text-body)] mb-1.5">
                    {config.label}
                    {config.optional && <span className="text-[var(--text-faint)] ml-1">(optional)</span>}
                  </label>
                  <input
                    type="text"
                    value={(fields[sourceType] as unknown as Record<string, string>)[config.key] ?? ''}
                    onChange={e => updateField(sourceType, config.key, e.target.value)}
                    placeholder={config.placeholder}
                    className="input-field"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button onClick={handleGenerate} className="btn-primary w-full">
            Generate Citation
          </button>

          {/* Citation Output */}
          {citation && (
            <div className="glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <p
                  className="text-[var(--text-body)] leading-relaxed flex-1"
                  dangerouslySetInnerHTML={{
                    __html: citation.replace(/\*([^*]+)\*/g, '<em>$1</em>'),
                  }}
                />
                <button
                  onClick={handleCopy}
                  className="btn-secondary flex items-center gap-1.5 shrink-0"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </FormToolPage>
    </>
  )
}
