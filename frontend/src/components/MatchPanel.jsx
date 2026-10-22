export default function MatchPanel({ match, onEdit }) {
  if (!match) {
    return (
      <div className="card">
        <p className="empty">Add a job description and fix your resume again to see how well it matches.</p>
      </div>
    );
  }

  const level = match.score >= 70 ? 'high' : match.score >= 45 ? 'mid' : 'low';
  const label = level === 'high' ? 'Strong match' : level === 'mid' ? 'Good start' : 'Big gaps';

  return (
    <div className="card match">
      <div className="score">
        <div className="score-ring" data-level={level} style={{ '--pct': match.score }}>
          <span>{match.score}%</span>
        </div>
        <div>
          <h2>{label}</h2>
          <p className="muted">
            Your resume mentions {match.matched.length} of the {match.matched.length + match.missing.length} skills and keywords this job asks for. The score updates as you edit.
          </p>
        </div>
      </div>

      <h3>Already on your resume</h3>
      <div className="chips">
        {match.matched.length ? match.matched.map((k) => <span className="chip ok" key={k}>{k}</span>) : <p className="empty">None yet.</p>}
      </div>

      <h3>Missing from your resume</h3>
      <div className="chips">
        {match.missing.length ? match.missing.map((k) => <span className="chip miss" key={k}>{k}</span>) : <p className="empty">Nothing missing.</p>}
      </div>
      {match.missing.length > 0 && (
        <p className="muted small">
          Only add a missing skill if you really have it. Hiring managers will ask about it.{' '}
          <button className="link-btn" onClick={onEdit}>Edit my resume</button>
        </p>
      )}
    </div>
  );
}
