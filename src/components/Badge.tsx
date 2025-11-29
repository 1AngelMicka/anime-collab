export default function Badge({ children, color='gray' }: { children: React.ReactNode, color?: 'gray'|'green'|'amber' }) {
  return <span className={`badge ${color==='green'?'badge-green': color==='amber'?'badge-amber':'badge-gray'}`}>{children}</span>
}
