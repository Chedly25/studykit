import { useState, useEffect } from 'react'
import { getTransient } from '../../lib/transientStore'
import { CodePlayground } from '../session/CodePlayground'

interface CodePlaygroundData {
  code: string
  language: string
  instructions: string
}

interface CodePlaygroundBlockProps {
  codeId: string
}

export function CodePlaygroundBlock({ codeId }: CodePlaygroundBlockProps) {
  const [data, setData] = useState<CodePlaygroundData | null>(null)

  useEffect(() => {
    const stored = getTransient<CodePlaygroundData>(codeId)
    if (stored) setData(stored)
  }, [codeId])

  if (!data) {
    return (
      <div className="my-3 glass-card p-4 animate-pulse">
        <div className="h-4 bg-[var(--bg-input)] rounded w-1/3 mb-3" />
        <div className="h-32 bg-[var(--bg-input)] rounded" />
      </div>
    )
  }

  return (
    <div className="my-3">
      <CodePlayground
        initialCode={data.code}
        language={data.language}
        instructions={data.instructions}
      />
    </div>
  )
}
