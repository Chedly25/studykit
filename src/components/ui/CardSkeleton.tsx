import { SkeletonBlock, SkeletonLine } from '../Skeleton'

interface CardSkeletonProps {
  lines?: number
  showAvatar?: boolean
  className?: string
}

export function CardSkeleton({ lines = 3, showAvatar = false, className = '' }: CardSkeletonProps) {
  return (
    <div className={`glass-card p-5 ${className}`}>
      <div className="flex items-start gap-3">
        {showAvatar && <SkeletonBlock height="h-10" width="w-10" />}
        <div className="flex-1 space-y-2.5">
          <SkeletonLine width="w-2/3" />
          {Array.from({ length: lines }).map((_, i) => (
            <SkeletonLine key={i} width={i === lines - 1 ? 'w-1/2' : 'w-full'} />
          ))}
        </div>
      </div>
    </div>
  )
}
