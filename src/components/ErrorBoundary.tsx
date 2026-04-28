import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import * as Sentry from '@sentry/react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  resetKey: number
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, resetKey: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack ?? '' } } })
  }

  handleReload = () => {
    // Incrementing resetKey forces children to fully remount
    this.setState(prev => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[50vh] px-4">
          <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-error-bg)] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-[var(--color-error)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-heading)]">Something went wrong</h2>
            <p className="text-sm text-[var(--text-muted)]">
              An unexpected error occurred. Try reloading this section.
            </p>
            {this.state.error && (
              <details className="text-left">
                <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-body)]">
                  Error details
                </summary>
                <pre className="mt-2 text-xs text-[var(--color-error)] bg-[var(--color-error-bg)] rounded-lg p-3 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReload}
              className="btn-primary px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reload
            </button>
          </div>
        </div>
      )
    }

    // Key forces full remount of children on reset
    return <div key={this.state.resetKey}>{this.props.children}</div>
  }
}
