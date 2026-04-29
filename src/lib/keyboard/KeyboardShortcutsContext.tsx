import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export interface RegisteredShortcut {
  id: string
  combo: string
  display: string
  label: string
  scope: string
  enabled: boolean
}

interface ContextValue {
  shortcuts: RegisteredShortcut[]
  register: (s: RegisteredShortcut) => void
  unregister: (id: string) => void
}

const KeyboardShortcutsContext = createContext<ContextValue | null>(null)

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<RegisteredShortcut[]>([])

  const register = useCallback((s: RegisteredShortcut) => {
    setShortcuts((prev) => {
      const next = prev.filter((x) => x.id !== s.id)
      next.push(s)
      return next
    })
  }, [])

  const unregister = useCallback((id: string) => {
    setShortcuts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  return (
    <KeyboardShortcutsContext.Provider value={{ shortcuts, register, unregister }}>
      {children}
    </KeyboardShortcutsContext.Provider>
  )
}

export function useKeyboardShortcutsRegistry(): ContextValue {
  const ctx = useContext(KeyboardShortcutsContext)
  if (!ctx) {
    throw new Error('useKeyboardShortcutsRegistry must be used inside KeyboardShortcutsProvider')
  }
  return ctx
}
