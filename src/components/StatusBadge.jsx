const statusStyles = {
  'In Stock': 'border-cyan-500/40 text-cyan-400',
  'Low Stock': 'border-fuchsia-500/40 text-fuchsia-400',
  'Expiring soon': 'border-amber-500/40 text-amber-400',
  'Out of Stock': 'border-red-500/40 text-red-400',
}

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
        statusStyles[status] || 'border-slate-700 text-slate-300'
      }`}
    >
      {status}
    </span>
  )
}
