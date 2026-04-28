import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helper?: string
  error?: string
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, iconLeft, iconRight, id, className = '', ...rest },
  ref,
) {
  const reactId = useId()
  const inputId = id ?? reactId
  const helperId = `${inputId}-helper`

  const fieldClasses = [
    'input-field',
    error ? 'border-[var(--color-error)] focus:border-[var(--color-error)]' : '',
    iconLeft ? 'pl-10' : '',
    iconRight ? 'pr-10' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const showHelper = error || helper

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-[var(--text-heading)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--text-faint)]"
          >
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={showHelper ? helperId : undefined}
          className={fieldClasses}
          {...rest}
        />
        {iconRight && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--text-faint)]"
          >
            {iconRight}
          </span>
        )}
      </div>
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
