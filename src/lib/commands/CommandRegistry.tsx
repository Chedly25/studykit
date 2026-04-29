import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'

export interface Command {
  id: string
  label: string
  group?: string
  hint?: string
  icon?: ComponentType<{ className?: string }>
  keywords?: string[]
  perform: () => void | Promise<void>
}

interface ContextValue {
  commands: Command[]
  register: (c: Command) => void
  unregister: (id: string) => void
  recents: string[]
  recordExecution: (id: string) => void
}

const CommandRegistryContext = createContext<ContextValue | null>(null)

const RECENTS_KEY = 'studieskit:command-recents'
const RECENTS_LIMIT = 5

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, RECENTS_LIMIT) : []
  } catch {
    return []
  }
}

export function CommandRegistryProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<Command[]>([])
  const [recents, setRecents] = useState<string[]>(readRecents)

  const register = useCallback((c: Command) => {
    setCommands((prev) => {
      const next = prev.filter((x) => x.id !== c.id)
      next.push(c)
      return next
    })
  }, [])

  const unregister = useCallback((id: string) => {
    setCommands((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const recordExecution = useCallback((id: string) => {
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENTS_LIMIT)
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
      } catch {
        /* localStorage unavailable */
      }
      return next
    })
  }, [])

  return (
    <CommandRegistryContext.Provider
      value={{ commands, register, unregister, recents, recordExecution }}
    >
      {children}
    </CommandRegistryContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCommandRegistry(): ContextValue {
  const ctx = useContext(CommandRegistryContext)
  if (!ctx) {
    throw new Error('useCommandRegistry must be used inside CommandRegistryProvider')
  }
  return ctx
}
