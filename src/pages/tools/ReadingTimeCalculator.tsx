import { useState, useMemo } from 'react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('reading-time-calculator')!

type InputMode = 'text' | 'wordcount'

function formatTime(totalSeconds: number): string {
  if (totalSeconds < 1) return '0 sec'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.round(totalSeconds % 60)
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} hr`)
  if (minutes > 0) parts.push(`${minutes} min`)
  if (seconds > 0 && hours === 0) parts.push(`${seconds} sec`)
  return parts.join(' ')
}

function getSpeedLabel(wpm: number): string {
  if (wpm <= 220) return 'Slow'
  if (wpm <= 280) return 'Average'
  return 'Fast'
}

export default function ReadingTimeCalculator() {
  const [mode, setMode] = useState<InputMode>('text')
  const [text, setText] = useState('')
  const [wordCountInput, setWordCountInput] = useState('')
  const [wpm, setWpm] = useState(238)

  const wordCount = useMemo(() => {
    if (mode === 'text') {
      return text.split(/\s+/).filter(w => w.length > 0).length
    }
    const parsed = parseInt(wordCountInput, 10)
    return isNaN(parsed) || parsed < 0 ? 0 : parsed
  }, [mode, text, wordCountInput])

  const results = useMemo(() => {
    const readingSeconds = (wordCount / wpm) * 60
    // Scale speaking WPM proportionally: base 150 WPM at default 238 reading WPM
    const speakingWpm = Math.round((150 / 238) * wpm)
    const speakingSeconds = (wordCount / speakingWpm) * 60
    const pages = wordCount / 250

    return {
      readingTime: formatTime(readingSeconds),
      speakingTime: formatTime(speakingSeconds),
      pages: pages.toFixed(1),
    }
  }, [wordCount, wpm])

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
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('text')}
              className={mode === 'text' ? 'btn-primary' : 'btn-secondary'}
            >
              Paste Text
            </button>
            <button
              onClick={() => setMode('wordcount')}
              className={mode === 'wordcount' ? 'btn-primary' : 'btn-secondary'}
            >
              Enter Word Count
            </button>
          </div>

          {/* Input */}
          {mode === 'text' ? (
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your text here..."
              className="input-field min-h-[160px] resize-y"
              rows={6}
            />
          ) : (
            <input
              type="number"
              min={0}
              value={wordCountInput}
              onChange={e => setWordCountInput(e.target.value)}
              placeholder="Enter number of words"
              className="input-field"
            />
          )}

          {/* WPM Slider */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-surface-300">
                Reading Speed
              </label>
              <span className="text-sm text-primary-400 font-medium">
                {wpm} WPM ({getSpeedLabel(wpm)})
              </span>
            </div>
            <input
              type="range"
              min={200}
              max={400}
              step={1}
              value={wpm}
              onChange={e => setWpm(Number(e.target.value))}
              className="w-full accent-primary-500"
            />
            <div className="flex justify-between text-xs text-surface-500 mt-1">
              <span>200 (Slow)</span>
              <span>300 (Average)</span>
              <span>400 (Fast)</span>
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass-card p-4 text-center">
              <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary-400">
                {results.readingTime}
              </div>
              <div className="text-surface-400 text-sm mt-1">Reading Time</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary-400">
                {results.speakingTime}
              </div>
              <div className="text-surface-400 text-sm mt-1">Speaking Time</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary-400">
                {results.pages}
              </div>
              <div className="text-surface-400 text-sm mt-1">Pages (est.)</div>
            </div>
          </div>

          {/* Word count display */}
          <p className="text-center text-sm text-surface-500">
            {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'} at {wpm} words per minute
          </p>
        </div>
      </FormToolPage>
    </>
  )
}
