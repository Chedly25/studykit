import { useEffect, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps focus within a container element.
 * On mount: focuses first focusable element.
 * On Tab: cycles focus within the container.
 * On unmount: restores previous focus.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active || !ref.current) return

    const container = ref.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Focus the first focusable element
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (focusables.length > 0) {
      focusables[0].focus()
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (elements.length === 0) return

      const first = elements[0]
      const last = elements[elements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      previouslyFocused?.focus()
    }
  }, [ref, active])
}
