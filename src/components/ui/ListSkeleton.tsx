import { SkeletonBlock, SkeletonLine } from '../Skeleton'

interface ListSkeletonProps {
  rows?: number
  className?: string
}

export function ListSkeleton({ rows = 5, className = '' }: ListSkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-card)] border border-[var(--border-card)]"
        >
          <SkeletonBlock height="h-8" width="w-8" />
          <div className="flex-1 space-y-1.5">
            <SkeletonLine width="w-3/4" />
            <SkeletonLine width="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
