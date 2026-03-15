import { useState, useMemo } from 'react'
import { Eraser, ChevronDown, ChevronUp } from 'lucide-react'
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
      <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--accent-text)]">
        {value}
      </div>
      <div className="text-[var(--text-muted)] text-sm mt-1">{label}</div>
    </div>
  )
}

export default function WordCounter() {
  const [text, setText] = useState('')
  const [wpm, setWpm] = useState(238)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const stats = useMemo(() => {
    const words = countWords(text)
    const readingSeconds = (words / wpm) * 60
    const speakingSeconds = (words / 150) * 60
    const pages = Math.ceil(words / 250) || 0

    return {
      words,
      characters: countCharacters(text),
      charactersNoSpaces: countCharactersNoSpaces(text),
      sentences: countSentences(text),
      paragraphs: countParagraphs(text),
      readingTime: formatTime(readingSeconds),
      speakingTime: formatTime(speakingSeconds),
      pages,
    }
  }, [text, wpm])

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
                className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--accent-bg)] transition-colors"
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
            <StatBox label="Pages (est.)" value={String(stats.pages)} />
          </div>

          {/* Advanced section */}
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => setShowAdvanced(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-[var(--text-body)] hover:text-[var(--text-heading)] transition-colors"
            >
              <span className="text-sm font-medium">Advanced Settings</span>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showAdvanced && (
              <div className="px-4 pb-4 border-t border-[var(--border-card)]">
                <div className="pt-4">
                  <label className="text-[var(--text-muted)] text-xs uppercase tracking-wider block mb-2">
                    Reading Speed: {wpm} WPM
                  </label>
                  <input
                    type="range"
                    min={200}
                    max={400}
                    step={1}
                    value={wpm}
                    onChange={e => setWpm(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none bg-[var(--border-card)] cursor-pointer accent-primary-500"
                  />
                  <div className="flex justify-between text-[var(--text-faint)] text-xs mt-1">
                    <span>200 WPM</span>
                    <span>400 WPM</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </FormToolPage>
    </>
  )
}
