import { forwardRef, createElement, type HTMLAttributes, type ReactNode } from 'react'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type Tone = 'heading' | 'body' | 'muted' | 'faint' | 'accent' | 'success' | 'error' | 'warning' | 'info'
type Weight = 400 | 500 | 600 | 700

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: 'p' | 'span' | 'div' | 'label' | 'small' | 'strong' | 'em'
  size?: Size
  tone?: Tone
  weight?: Weight
  mono?: boolean
  children?: ReactNode
}

const sizeClass: Record<Size, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
}

const toneClass: Record<Tone, string> = {
  heading: 'text-[var(--text-heading)]',
  body:    'text-[var(--text-body)]',
  muted:   'text-[var(--text-muted)]',
  faint:   'text-[var(--text-faint)]',
  accent:  'text-[var(--accent-text)]',
  success: 'text-[var(--color-success)]',
  error:   'text-[var(--color-error)]',
  warning: 'text-[var(--color-warning)]',
  info:    'text-[var(--color-info)]',
}

const weightClass: Record<Weight, string> = {
  400: 'font-normal',
  500: 'font-medium',
  600: 'font-semibold',
  700: 'font-bold',
}

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { as = 'p', size = 'md', tone = 'body', weight = 400, mono = false, className = '', children, ...rest },
  ref,
) {
  const fontClass = mono ? 'font-[family-name:var(--font-mono)]' : ''
  const classes = [
    fontClass,
    sizeClass[size],
    toneClass[tone],
    weightClass[weight],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return createElement(as, { ref, className: classes, ...rest }, children)
})
