import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  children: ReactNode
  className?: string
}

export function Modal({ open, children, className }: ModalProps) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
          transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ModalBackdropProps {
  open: boolean
  onClose?: () => void
  children: ReactNode
  className?: string
}

export function ModalBackdrop({ open, onClose, children, className }: ModalBackdropProps) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
          onClick={onClose}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
