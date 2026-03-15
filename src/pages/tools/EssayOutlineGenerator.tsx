import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('essay-outline-generator')!

type EssayType = 'argumentative' | 'expository' | 'persuasive' | 'compare-contrast'

interface OutlineSection {
  heading: string
  items: string[]
}

function buildOutline(topic: string, essayType: EssayType, bodyCount: number): OutlineSection[] {
  const t = topic || '[Your Topic]'

  switch (essayType) {
    case 'argumentative': {
      const sections: OutlineSection[] = [
        {
          heading: 'I. Introduction',
          items: [
            `Hook: Open with a compelling fact or question about ${t}`,
            `Background: Provide context and relevant information on ${t}`,
            `Thesis: State your clear position on ${t}`,
          ],
        },
      ]
      for (let i = 1; i <= bodyCount; i++) {
        sections.push({
          heading: `${romanize(i + 1)}. Body Paragraph ${i}`,
          items: [
            `Claim: State your ${ordinal(i)} argument supporting your position on ${t}`,
            'Evidence: Provide a specific fact, quote, or data to support this claim',
            'Analysis: Explain how this evidence supports your thesis',
          ],
        })
      }
      sections.push({
        heading: `${romanize(bodyCount + 2)}. Counterargument`,
        items: [
          'Opposing view: Acknowledge the strongest counterargument',
          'Rebuttal: Explain why your position is still stronger',
        ],
      })
      sections.push({
        heading: `${romanize(bodyCount + 3)}. Conclusion`,
        items: [
          'Restate thesis in new words',
          'Summarize key arguments',
          `Closing thought: End with a broader implication of ${t}`,
        ],
      })
      return sections
    }

    case 'expository': {
      const sections: OutlineSection[] = [
        {
          heading: 'I. Introduction',
          items: [
            `Hook: Engage the reader with an interesting fact about ${t}`,
            `Context: Provide background information on ${t}`,
            `Thesis: State the main point you will explain about ${t}`,
          ],
        },
      ]
      for (let i = 1; i <= bodyCount; i++) {
        sections.push({
          heading: `${romanize(i + 1)}. Body Paragraph ${i}`,
          items: [
            `Topic sentence: Introduce the ${ordinal(i)} aspect of ${t}`,
            'Explanation: Elaborate on this point with clear details',
            'Examples: Provide specific examples or evidence',
          ],
        })
      }
      sections.push({
        heading: `${romanize(bodyCount + 2)}. Conclusion`,
        items: [
          'Restate thesis',
          'Summarize the key points explained',
          `Final insight: Leave the reader with a takeaway about ${t}`,
        ],
      })
      return sections
    }

    case 'persuasive': {
      const sections: OutlineSection[] = [
        {
          heading: 'I. Introduction',
          items: [
            `Hook: Start with a striking statement about ${t}`,
            `Issue: Describe the problem or debate around ${t}`,
            `Position: State your clear stance on ${t}`,
          ],
        },
      ]
      for (let i = 1; i <= bodyCount; i++) {
        sections.push({
          heading: `${romanize(i + 1)}. Body Paragraph ${i}`,
          items: [
            `Reason: Present your ${ordinal(i)} reason supporting your position`,
            'Evidence: Back it up with facts, statistics, or expert opinions',
            'Appeal: Connect to the reader through logical, emotional, or ethical appeal',
          ],
        })
      }
      sections.push({
        heading: `${romanize(bodyCount + 2)}. Call to Action`,
        items: [
          'Urge the reader to take a specific action or adopt your viewpoint',
          `Explain what would happen if the audience acts on ${t}`,
        ],
      })
      sections.push({
        heading: `${romanize(bodyCount + 3)}. Conclusion`,
        items: [
          'Restate your position with conviction',
          'Summarize persuasive points',
          'End with a memorable closing statement',
        ],
      })
      return sections
    }

    case 'compare-contrast': {
      const sections: OutlineSection[] = [
        {
          heading: 'I. Introduction',
          items: [
            `Hook: Introduce the two subjects related to ${t}`,
            'Purpose: Explain why comparing these subjects is valuable',
            `Thesis: State the main point of your comparison of ${t}`,
          ],
        },
      ]
      for (let i = 1; i <= bodyCount; i++) {
        sections.push({
          heading: `${romanize(i + 1)}. Body Paragraph ${i} — Point of Comparison ${i}`,
          items: [
            `Point: Identify the ${ordinal(i)} aspect to compare`,
            'Subject A: Describe how the first subject relates to this point',
            'Subject B: Describe how the second subject relates to this point',
            'Analysis: Discuss the significance of this similarity or difference',
          ],
        })
      }
      sections.push({
        heading: `${romanize(bodyCount + 2)}. Conclusion`,
        items: [
          'Restate thesis',
          'Summarize the most important similarities and differences',
          `Final reflection: State which subject is stronger or what the comparison reveals about ${t}`,
        ],
      })
      return sections
    }
  }
}

function romanize(num: number): string {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
  return roman[num - 1] ?? String(num)
}

function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`
}

export default function EssayOutlineGenerator() {
  const [topic, setTopic] = useState('')
  const [essayType, setEssayType] = useState<EssayType>('argumentative')
  const [bodyCount, setBodyCount] = useState(3)
  const [, setOutline] = useState<OutlineSection[]>([])
  const [editedOutline, setEditedOutline] = useState<OutlineSection[]>([])
  const [copied, setCopied] = useState(false)

  function handleGenerate() {
    const result = buildOutline(topic, essayType, bodyCount)
    setOutline(result)
    setEditedOutline(result.map(s => ({ ...s, items: [...s.items] })))
    setCopied(false)
  }

  const updateItem = useCallback((sectionIdx: number, itemIdx: number, value: string) => {
    setEditedOutline(prev => {
      const next = prev.map(s => ({ ...s, items: [...s.items] }))
      next[sectionIdx].items[itemIdx] = value
      return next
    })
  }, [])

  async function handleCopy() {
    const text = editedOutline
      .map(section => {
        const items = section.items.map(item => `  - ${item}`).join('\n')
        return `${section.heading}\n${items}`
      })
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          {/* Inputs */}
          <div className="glass-card p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Essay Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g., The impact of social media on mental health"
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Essay Type
                </label>
                <select
                  value={essayType}
                  onChange={e => setEssayType(e.target.value as EssayType)}
                  className="select-field"
                >
                  <option value="argumentative">Argumentative</option>
                  <option value="expository">Expository</option>
                  <option value="persuasive">Persuasive</option>
                  <option value="compare-contrast">Compare & Contrast</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Body Paragraphs
                </label>
                <select
                  value={bodyCount}
                  onChange={e => setBodyCount(Number(e.target.value))}
                  className="select-field"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
            </div>
          </div>

          <button onClick={handleGenerate} className="btn-primary w-full">
            Generate Outline
          </button>

          {/* Outline Output */}
          {editedOutline.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-surface-100">
                  Your Outline
                </h3>
                <button
                  onClick={handleCopy}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy Outline'}
                </button>
              </div>

              {editedOutline.map((section, sIdx) => (
                <div key={sIdx} className="glass-card p-5">
                  <h4 className="font-[family-name:var(--font-display)] font-semibold text-primary-400 mb-3">
                    {section.heading}
                  </h4>
                  <div className="space-y-2">
                    {section.items.map((item, iIdx) => (
                      <textarea
                        key={iIdx}
                        value={item}
                        onChange={e => updateItem(sIdx, iIdx, e.target.value)}
                        className="input-field text-sm resize-none"
                        rows={2}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </FormToolPage>
    </>
  )
}
