import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

// Intentionally no `key={pathname}` — that would unmount/remount the entire
// Outlet subtree on every navigation, destroying page state and triggering
// cold re-fetches in components with `useEffect([])` data loads.
export function PageTransition({ children }: PageTransitionProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
