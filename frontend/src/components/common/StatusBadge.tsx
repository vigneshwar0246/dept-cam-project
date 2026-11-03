export function StatusBadge({ value }: { value: string }) {
  const kind = value.toLowerCase().replace(' ', '-')
  return <span className={`status-badge status-${kind}`}><span />{value}</span>
}
