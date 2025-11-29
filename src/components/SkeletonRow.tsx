export default function SkeletonRow() {
  return (
    <div className="flex items-center gap-3">
      <div className="skeleton w-12 h-16" />
      <div className="flex-1">
        <div className="skeleton h-4 w-40 mb-2" />
        <div className="skeleton h-3 w-56" />
      </div>
      <div className="skeleton h-8 w-24" />
    </div>
  )
}
