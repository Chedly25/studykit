import { useState } from 'react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('paraphrasing-helper')!

const synonymPairs: [string, string][] = [
  ['important', 'significant / crucial / vital'],
  ['show', 'demonstrate / illustrate / indicate'],
  ['use', 'utilize / employ / apply'],
  ['help', 'assist / facilitate / support'],
  ['big', 'substantial / considerable / extensive'],
  ['get', 'obtain / acquire / gain'],
  ['give', 'provide / offer / supply'],
  ['make', 'create / produce / generate'],
  ['think', 'believe / consider / argue'],
  ['good', 'effective / beneficial / advantageous'],
  ['bad', 'detrimental / adverse / unfavorable'],
  ['many', 'numerous / several / various'],
  ['change', 'alter / modify / transform'],
  ['increase', 'expand / enhance / amplify'],
]

const restructuringTips = [
  'Change active voice to passive voice (or vice versa). "Researchers found..." becomes "It was found by researchers..."',
  'Break one long sentence into two shorter ones, or combine two short sentences into one.',
  'Start the sentence with a different element (e.g., an adverb, a prepositional phrase, or a subordinate clause).',
  'Change the order of clauses. Move the dependent clause before or after the main clause.',
  'Replace a phrase with a single word, or expand a single word into a phrase for clarity.',
  'Convert a direct statement into a question or conditional form where appropriate.',
]

interface ChecklistItem {
  id: string
  label: string
}

const checklistItems: ChecklistItem[] = [
  { id: 'vocabulary', label: 'Changed vocabulary (replaced key words with synonyms)' },
  { id: 'structure', label: 'Restructured sentences (changed word order or sentence form)' },
  { id: 'meaning', label: 'Kept the original meaning intact' },
  { id: 'citation', label: 'Added a citation to the original source' },
  { id: 'voice', label: 'Used my own voice and writing style' },
]

export default function ParaphrasingHelper() {
  const [text, setText] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  function toggleCheck(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Textarea */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Paste original text here
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste the text you want to paraphrase..."
              className="input-field min-h-[300px] resize-y"
              rows={12}
            />
          </div>

          {/* Right: Tips & Reference */}
          <div className="space-y-5">
            {/* Synonym Suggestions */}
            <div className="glass-card p-5">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100 mb-3">
                Synonym Suggestions
              </h3>
              <div className="space-y-1.5">
                {synonymPairs.map(([word, synonyms]) => (
                  <div key={word} className="flex gap-2 text-sm">
                    <span className="text-primary-400 font-medium w-20 shrink-0">{word}</span>
                    <span className="text-surface-400">{synonyms}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Restructuring Tips */}
            <div className="glass-card p-5">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100 mb-3">
                Restructuring Tips
              </h3>
              <ol className="space-y-2 list-decimal list-inside">
                {restructuringTips.map((tip, i) => (
                  <li key={i} className="text-sm text-surface-300 leading-relaxed">
                    {tip}
                  </li>
                ))}
              </ol>
            </div>

            {/* Checklist */}
            <div className="glass-card p-5">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100 mb-3">
                Paraphrasing Checklist
              </h3>
              <div className="space-y-2.5">
                {checklistItems.map(item => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={checked[item.id] ?? false}
                      onChange={() => toggleCheck(item.id)}
                      className="mt-0.5 w-4 h-4 rounded border-surface-600 text-primary-500 focus:ring-primary-500 accent-primary-500"
                    />
                    <span
                      className={`text-sm leading-relaxed transition-colors ${
                        checked[item.id] ? 'text-primary-400 line-through' : 'text-surface-300'
                      }`}
                    >
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </FormToolPage>
    </>
  )
}
