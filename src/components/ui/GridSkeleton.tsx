import { CardSkeleton } from './CardSkeleton'

interface GridSkeletonProps {
  count?: number
  columns?: 1 | 2 | 3 | 4
  className?: string
}

const columnClass: Record<NonNullable<GridSkeletonProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

export function GridSkeleton({ count = 6, columns = 3, className = '' }: GridSkeletonProps) {
  return (
    <div className={`grid gap-4 ${columnClass[columns]} ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  )
}
