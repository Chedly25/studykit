import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

type Variant = 'default' | 'bordered' | 'flat'
type Padding = 'none' | 'compact' | 'default' | 'spacious'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: Padding
  hover?: boolean
  as?: 'div' | 'article' | 'section' | 'aside'
  children?: ReactNode
}

const variantClass: Record<Variant, string> = {
  default: 'glass-card',
  bordered: 'bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-[var(--radius-lg)]',
  flat: 'bg-[var(--bg-subtle)] rounded-[var(--radius-lg)]',
}

const paddingClass: Record<Padding, string> = {
  none: '',
  compact: 'p-3',
  default: 'p-5',
  spacious: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant = 'default',
    padding = 'default',
    hover = false,
    as = 'div',
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const Component = as as 'div'
  const classes = [
    variantClass[variant],
    paddingClass[padding],
    hover ? 'glass-card-hover' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Component ref={ref} className={classes} {...rest}>
      {children}
    </Component>
  )
})
