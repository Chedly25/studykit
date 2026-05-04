export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />
  )
}
