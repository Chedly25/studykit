import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

interface StaggerProps {
  staggerDelay?: number
  initialDelay?: number
  children: ReactNode
  className?: string
}

export function Stagger({
  staggerDelay = 0.06,
  initialDelay = 0,
  children,
  className,
}: StaggerProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduced ? 0 : staggerDelay,
            delayChildren: initialDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps {
  children: ReactNode
  className?: string
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
