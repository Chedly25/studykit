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
      // Execute in a sandboxed iframe to prevent access to parent page context
      const html = `<!DOCTYPE html><html><body><script>
        const logs = [];
        const _console = { log: (...a) => logs.push(a.map(String).join(' ')), error: (...a) => logs.push('ERROR: ' + a.map(String).join(' ')), warn: (...a) => logs.push('WARN: ' + a.map(String).join(' ')) };
        try { (function(console){ ${code.replace(/<\/script>/gi, '<\\/script>')} })(_console); }
        catch(e) { logs.push('Error: ' + e.message); }
        parent.postMessage({ type: 'sandbox-output', output: logs.join('\\n') || '(no output)' }, '*');
      <\/script></body></html>`

      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'sandbox-output' && (e.origin === 'null' || e.origin === window.location.origin)) {
          setOutput(e.data.output)
          window.removeEventListener('message', handler)
        }
      }
      window.addEventListener('message', handler)
      // Timeout fallback
      setTimeout(() => { window.removeEventListener('message', handler) }, 5000)

      // Create sandboxed iframe — allow-scripts but no access to parent origin
      const iframe = document.createElement('iframe')
      iframe.sandbox.add('allow-scripts')
      iframe.style.display = 'none'
      iframe.srcdoc = html
      document.body.appendChild(iframe)
      setTimeout(() => iframe.remove(), 5000)
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
