import { forwardRef, useId, type SelectHTMLAttributes, type ReactNode } from 'react'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helper?: string
  error?: string
  children: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helper, error, id, className = '', children, ...rest },
  ref,
) {
  const reactId = useId()
  const selectId = id ?? reactId
  const helperId = `${selectId}-helper`

  const fieldClasses = [
    'select-field',
    'appearance-none pr-10 bg-no-repeat bg-[length:1rem] bg-[position:right_0.875rem_center]',
    error ? 'border-[var(--color-error)] focus:border-[var(--color-error)]' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const showHelper = error || helper

  // Inline chevron, color follows currentColor of parent text
  const chevronUrl =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'><path d='M1 1.5L6 6.5L11 1.5' stroke='%239A9588' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")"

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-sm font-medium text-[var(--text-heading)]"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={showHelper ? helperId : undefined}
        className={fieldClasses}
        style={{ backgroundImage: chevronUrl }}
        {...rest}
      >
        {children}
      </select>
      {showHelper && (
        <p
          id={helperId}
          className={`mt-1.5 text-xs ${error ? 'text-[var(--color-error)]' : 'text-[var(--text-muted)]'}`}
        >
          {error || helper}
        </p>
      )}
    </div>
  )
})
