import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathTextProps {
  children: string
  className?: string
}

/**
 * Renders text with inline LaTeX math ($...$) and display math ($$...$$).
 * Non-math text is rendered as-is.
 */
export function MathText({ children, className }: MathTextProps) {
  const html = useMemo(() => {
    if (!children) return ''
    try {
      // Replace display math first ($$...$$), then inline ($...$)
      let result = children.replace(/\$\$([\s\S]+?)\$\$/g, (_match, tex) => {
        try {
          return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })
        } catch { return `$$${tex}$$` }
      })
      result = result.replace(/\$([^\$]+?)\$/g, (_match, tex) => {
        try {
          return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false })
        } catch { return `$${tex}$` }
      })
      return result
    } catch {
      return children
    }
  }, [children])

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
