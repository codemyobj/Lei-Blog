interface EmptyStateProps {
  title: string
  description?: string
  icon?: string
}

export default function EmptyState({ title, description, icon = '📭' }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
      {description && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
    </div>
  )
}
