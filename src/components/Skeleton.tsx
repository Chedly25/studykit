export function SkeletonLine({ width = 'w-full' }: { width?: string }) {
  return <div className={`h-3 ${width} rounded bg-[var(--bg-input)] animate-pulse`} />
}

export function SkeletonBlock({ height = 'h-12', width = 'w-full' }: { height?: string; width?: string }) {
  return <div className={`${height} ${width} rounded-lg bg-[var(--bg-input)] animate-pulse`} />
}
