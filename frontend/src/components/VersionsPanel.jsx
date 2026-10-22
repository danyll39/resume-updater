function when(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function VersionsPanel({ versions, activeId, onLoad, onDelete }) {
  return (
    <section className="card versions" aria-label="Saved versions">
      <h2>Saved versions</h2>
      {versions.length === 0 ? (
        <p className="muted small">Fix a resume, then choose Save version to keep a copy for each job you apply to. Versions are saved in this browser only.</p>
      ) : (
        <ul>
          {versions.map((v) => (
            <li key={v.id} className={v.id === activeId ? 'active' : ''}>
              <button className="version-open" onClick={() => onLoad(v)}>
                <span className="version-name">{v.name}</span>
                <span className="version-meta">
                  {when(v.savedAt)}
                  {typeof v.score === 'number' && ` · ${v.score}% match`}
                  {v.letter?.text && ' · cover letter'}
                </span>
              </button>
              <button className="icon-btn" aria-label={`Delete ${v.name}`} title="Delete" onClick={() => onDelete(v)}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
