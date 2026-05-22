function StatCard({ label, value, note, tone = 'neutral' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <p className="stat-label">{label}</p>
      <strong>{value}</strong>
      {note ? <span>{note}</span> : null}
    </article>
  )
}

export default StatCard
