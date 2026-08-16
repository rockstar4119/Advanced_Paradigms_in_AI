interface StatTileProps {
  label: string
  value: string
  accent?: string
}

export function StatTile({ label, value, accent }: StatTileProps) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      <span className="stat-tile-label">{label}</span>
    </div>
  )
}
