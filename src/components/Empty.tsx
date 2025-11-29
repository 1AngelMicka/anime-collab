export default function Empty({ title, hint }: { title: string, hint?: string }) {
  return (
    <div className="text-sm opacity-70 text-center py-6">
      <div className="text-base opacity-90">{title}</div>
      {hint && <div className="mt-1">{hint}</div>}
    </div>
  )
}
