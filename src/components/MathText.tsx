import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathTextProps {
  children: string
  className?: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Renders text with inline LaTeX math ($...$) and display math ($$...$$).
 * Non-math text is HTML-escaped for safety.
 */
export function MathText({ children, className }: MathTextProps) {
  const html = useMemo(() => {
    if (!children) return ''
    try {
      // Split on math delimiters, preserving the delimiters
      // Process display math ($$...$$) first, then inline ($...$)
      const parts: string[] = []
      let remaining = children

      // Extract display math
      remaining = remaining.replace(/\$\$([\s\S]+?)\$\$/g, (_match, tex) => {
        const placeholder = `\x00DISPLAY_${parts.length}\x00`
        try {
          parts.push(katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }))
        } catch {
          parts.push(escapeHtml(`$$${tex}$$`))
        }
        return placeholder
      })

      // Extract inline math
      remaining = remaining.replace(/\$([^\$]+?)\$/g, (_match, tex) => {
        const placeholder = `\x00INLINE_${parts.length}\x00`
        try {
          parts.push(katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }))
        } catch {
          parts.push(escapeHtml(`$${tex}$`))
        }
        return placeholder
      })

      // Escape remaining (non-math) text, then restore math placeholders
      let result = escapeHtml(remaining)
      for (let i = 0; i < parts.length; i++) {
        result = result.replace(`\x00DISPLAY_${i}\x00`, parts[i])
        result = result.replace(`\x00INLINE_${i}\x00`, parts[i])
      }

      return result
    } catch {
      return escapeHtml(children)
    }
  }, [children])

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
