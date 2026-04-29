import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

interface SlideUpProps {
  delay?: number
  duration?: number
  distance?: number
  children: ReactNode
  className?: string
}

export function SlideUp({
  delay = 0,
  duration = 0.4,
  distance = 8,
  children,
  className,
}: SlideUpProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: reduced ? 0 : duration, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
