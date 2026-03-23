import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { basicSetup } from '@codemirror/basic-setup'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'

interface CodePlaygroundProps {
  initialCode?: string
  language?: string
  instructions?: string
  onCodeChange?: (code: string) => void
}

const LANGUAGE_EXTENSIONS: Record<string, () => ReturnType<typeof python>> = {
  python: python,
  javascript: javascript,
  js: javascript,
  py: python,
}

export function CodePlayground({ initialCode = '', language = 'python', instructions, onCodeChange }: CodePlaygroundProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [output, setOutput] = useState<string>('')
  const [hasRun, setHasRun] = useState(false)

  useEffect(() => {
    if (!editorRef.current) return

    const langExt = LANGUAGE_EXTENSIONS[language.toLowerCase()]

    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        basicSetup,
        ...(langExt ? [langExt()] : []),
        EditorView.theme({
          '&': { fontSize: '13px', maxHeight: '300px' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
          '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
        }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onCodeChange?.(update.state.doc.toString())
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view

    return () => view.destroy()
    // Only recreate on language change, not on initialCode change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const handleRun = useCallback(() => {
    const code = viewRef.current?.state.doc.toString() ?? ''
    setHasRun(true)

    if (language.toLowerCase() === 'javascript' || language.toLowerCase() === 'js') {
      try {
        const logs: string[] = []
        const mockConsole = { log: (...args: unknown[]) => logs.push(args.map(String).join(' ')) }
        const fn = new Function('console', code)
        fn(mockConsole)
        setOutput(logs.join('\n') || '(no output)')
      } catch (err) {
        setOutput(`Error: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else {
      setOutput('Python execution requires a server-side runtime.\nYour code looks correct — check the logic manually or ask the AI to review it.')
    }
  }, [language])

  const handleReset = useCallback(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: initialCode },
      })
    }
    setOutput('')
    setHasRun(false)
  }, [initialCode])

  return (
    <div className="glass-card overflow-hidden">
      {/* Instructions */}
      {instructions && (
        <div className="px-4 py-2.5 bg-[var(--accent-bg)]/50 border-b border-[var(--border-card)]">
          <p className="text-xs text-[var(--text-body)]">{instructions}</p>
        </div>
      )}

      {/* Editor */}
      <div ref={editorRef} className="border-b border-[var(--border-card)] bg-[var(--bg-input)]" />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-card)]">
        <button
          onClick={handleRun}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-text)] text-white hover:opacity-90 transition-opacity"
        >
          <Play className="w-3.5 h-3.5" /> Run
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
        <span className="text-[10px] text-[var(--text-muted)] ml-auto uppercase">{language}</span>
      </div>

      {/* Output */}
      {hasRun && (
        <div className="px-4 py-3 bg-gray-900 text-green-400 font-mono text-xs whitespace-pre-wrap max-h-[150px] overflow-y-auto">
          {output || '(no output)'}
        </div>
      )}
    </div>
  )
}
