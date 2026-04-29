import { SkeletonLine } from '../Skeleton'

interface FicheSkeletonProps {
  className?: string
}

export function FicheSkeleton({ className = '' }: FicheSkeletonProps) {
  return (
    <div className={`glass-card p-6 space-y-5 ${className}`}>
      <div className="space-y-2">
        <SkeletonLine width="w-1/3" />
        <SkeletonLine width="w-2/3" />
      </div>
      <div className="space-y-2">
        <SkeletonLine width="w-full" />
        <SkeletonLine width="w-full" />
        <SkeletonLine width="w-5/6" />
      </div>
      <div className="space-y-2">
        <SkeletonLine width="w-1/4" />
        <SkeletonLine width="w-full" />
        <SkeletonLine width="w-full" />
        <SkeletonLine width="w-3/4" />
      </div>
      <div className="space-y-2">
        <SkeletonLine width="w-1/4" />
        <SkeletonLine width="w-full" />
        <SkeletonLine width="w-2/3" />
      </div>
    </div>
  )
}
