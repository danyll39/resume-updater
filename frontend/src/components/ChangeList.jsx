// Each change can be kept (the default) or switched back to the original wording.
export default function ChangeList({ changes, onSetStatus, onSetAll }) {
  if (!changes.length) return <div className="card"><p className="empty">Gemini didn't change any wording.</p></div>;

  const kept = changes.filter((c) => c.status === 'accepted').length;

  return (
    <div className="card">
      <div className="changes-head">
        <p><strong>{kept} of {changes.length}</strong> changes kept. Undo any you don't like.</p>
        <div className="actions">
          <button className="btn small-btn" onClick={() => onSetAll('accepted')}>Keep all</button>
          <button className="btn small-btn" onClick={() => onSetAll('rejected')}>Undo all</button>
        </div>
      </div>
      <ol className="changes">
        {changes.map((c, i) => (
          <li key={i} className={`change ${c.status}`}>
            <div className="change-top">
              <span className="chg-section">{c.section}</span>
              <span className={`pill ${c.status}`}>{c.status === 'accepted' ? 'Kept' : 'Undone'}</span>
            </div>
            {c.before && <p className="chg-before"><del>{c.before}</del></p>}
            <p className="chg-after">{c.after}</p>
            {c.reason && <p className="chg-reason">{c.reason}</p>}
            <div className="change-actions">
              {c.status === 'accepted' ? (
                <button className="btn small-btn" onClick={() => onSetStatus(i, 'rejected')}>
                  {c.before ? 'Undo, use my original' : 'Remove this addition'}
                </button>
              ) : (
                <button className="btn small-btn" onClick={() => onSetStatus(i, 'accepted')}>Keep Gemini's version</button>
              )}
            </div>
            {c.note && <p className="chg-note" role="status">{c.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
