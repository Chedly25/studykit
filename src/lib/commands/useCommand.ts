import { useEffect, useMemo, useRef } from 'react'
import { useCommandRegistry, type Command } from './CommandRegistry'

/**
 * Register a command into the global registry while the calling component
 * is mounted. The `perform` handler is captured via ref so it always sees
 * the latest closure without forcing a re-register.
 */
export function useCommand(command: Command | null) {
  const { register, unregister } = useCommandRegistry()
  const performRef = useRef<Command['perform'] | undefined>(command?.perform)
  performRef.current = command?.perform

  // Stable identity-fields → only re-register when these change
  const stable = useMemo<Command | null>(() => {
    if (!command) return null
    return {
      id: command.id,
      label: command.label,
      group: command.group,
      hint: command.hint,
      icon: command.icon,
      keywords: command.keywords,
      perform: () => performRef.current?.(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    command?.id,
    command?.label,
    command?.group,
    command?.hint,
    command?.icon,
    command?.keywords?.join('|'),
  ])

  useEffect(() => {
    if (!stable) return
    register(stable)
    return () => unregister(stable.id)
  }, [stable, register, unregister])
}
