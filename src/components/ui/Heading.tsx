import { forwardRef, createElement, type HTMLAttributes, type ReactNode } from 'react'

type Level = 1 | 2 | 3 | 4 | 5 | 6
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
type Tone = 'heading' | 'body' | 'muted' | 'accent'

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: Level
  size?: Size
  tone?: Tone
  weight?: 400 | 500 | 600 | 700
  font?: 'display' | 'body'
  children?: ReactNode
}

const sizeClass: Record<Size, string> = {
  xs:  'text-xs',
  sm:  'text-sm',
  md:  'text-base',
  lg:  'text-lg',
  xl:  'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl md:text-[2.75rem] md:leading-[1.05]',
  '5xl': 'text-[2.5rem] leading-[1.05] md:text-[3.5rem]',
}

const defaultSizeForLevel: Record<Level, Size> = {
  1: '4xl',
  2: '2xl',
  3: 'xl',
  4: 'lg',
  5: 'md',
  6: 'sm',
}

const toneClass: Record<Tone, string> = {
  heading: 'text-[var(--text-heading)]',
  body: 'text-[var(--text-body)]',
  muted: 'text-[var(--text-muted)]',
  accent: 'text-[var(--accent-text)]',
}

const weightClass: Record<NonNullable<HeadingProps['weight']>, string> = {
  400: 'font-normal',
  500: 'font-medium',
  600: 'font-semibold',
  700: 'font-bold',
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { level = 2, size, tone = 'heading', weight = 600, font = 'display', className = '', children, ...rest },
  ref,
) {
  const resolvedSize = size ?? defaultSizeForLevel[level]
  const fontClass =
    font === 'display'
      ? 'font-[family-name:var(--font-display)]'
      : 'font-[family-name:var(--font-body)]'

  const classes = [
    fontClass,
    sizeClass[resolvedSize],
    toneClass[tone],
    weightClass[weight],
    'tracking-tight',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return createElement(`h${level}`, { ref, className: classes, ...rest }, children)
})
