import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helper?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, id, className = '', rows = 4, ...rest },
  ref,
) {
  const reactId = useId()
  const textareaId = id ?? reactId
  const helperId = `${textareaId}-helper`

  const fieldClasses = [
    'input-field',
    'resize-y',
    error ? 'border-[var(--color-error)] focus:border-[var(--color-error)]' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const showHelper = error || helper

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textareaId}
          className="mb-1.5 block text-sm font-medium text-[var(--text-heading)]"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={showHelper ? helperId : undefined}
        className={fieldClasses}
        {...rest}
      />
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
