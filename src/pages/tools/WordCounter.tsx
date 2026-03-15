import { useState, useMemo } from 'react'
import { Eraser } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('word-counter')!

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}

function countCharacters(text: string): number {
  return text.length
}

function countCharactersNoSpaces(text: string): number {
  return text.replace(/\s/g, '').length
}

function countSentences(text: string): number {
  if (text.trim().length === 0) return 0
  const matches = text.match(/[.!?](?:\s|$)/g)
  return matches ? matches.length : 0
}

function countParagraphs(text: string): number {
  return text.split(/\n\n+/).filter(p => p.trim().length > 0).length
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)
  if (minutes === 0) return `${seconds} sec`
  return `${minutes} min ${seconds} sec`
}

interface StatBoxProps {
  label: string
  value: string
}

function StatBox({ label, value }: StatBoxProps) {
  return (
    <div className="glass-card p-4 text-center">
      <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary-400">
        {value}
      </div>
      <div className="text-surface-400 text-sm mt-1">{label}</div>
    </div>
  )
}

export default function WordCounter() {
  const [text, setText] = useState('')

  const stats = useMemo(() => {
    const words = countWords(text)
    const readingSeconds = (words / 238) * 60
    const speakingSeconds = (words / 150) * 60

    return {
      words,
      characters: countCharacters(text),
      charactersNoSpaces: countCharactersNoSpaces(text),
      sentences: countSentences(text),
      paragraphs: countParagraphs(text),
      readingTime: formatTime(readingSeconds),
      speakingTime: formatTime(speakingSeconds),
    }
  }, [text])

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
          {/* Textarea */}
          <div className="relative">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type or paste your text here..."
              className="input-field min-h-[200px] resize-y"
              rows={8}
            />
            {text.length > 0 && (
              <button
                onClick={() => setText('')}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
                aria-label="Clear text"
              >
                <Eraser size={18} />
              </button>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="Words" value={String(stats.words)} />
            <StatBox label="Characters" value={String(stats.characters)} />
            <StatBox label="Characters (no spaces)" value={String(stats.charactersNoSpaces)} />
            <StatBox label="Sentences" value={String(stats.sentences)} />
            <StatBox label="Paragraphs" value={String(stats.paragraphs)} />
            <StatBox label="Reading Time" value={stats.readingTime} />
            <StatBox label="Speaking Time" value={stats.speakingTime} />
          </div>
        </div>
      </FormToolPage>
    </>
  )
}
