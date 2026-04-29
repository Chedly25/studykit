import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

interface FadeInProps {
  delay?: number
  duration?: number
  children: ReactNode
  className?: string
}

export function FadeIn({ delay = 0, duration = 0.4, children, className }: FadeInProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: reduced ? 0 : duration, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
