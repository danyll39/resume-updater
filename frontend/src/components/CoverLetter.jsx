const TONES = [
  ['professional', 'Professional'],
  ['warm', 'Warm'],
  ['confident', 'Confident']
];

export default function CoverLetter({ resume, letter, setLetter, onWrite, hasJobDesc }) {
  const set = (key) => (e) => setLetter({ ...letter, [key]: e.target.value });
  const contact = [resume.location, resume.phone, resume.email].filter(Boolean).join(' · ');
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const canWrite = !letter.loading && (hasJobDesc || letter.jobTitle.trim());

  return (
    <>
      <div className="card letter-form">
        <div className="row">
          <label className="field">Company<input type="text" value={letter.company} onChange={set('company')} placeholder="e.g. Brightpath Learning" /></label>
          <label className="field">Job title<input type="text" value={letter.jobTitle} onChange={set('jobTitle')} placeholder="e.g. Front-End Developer" /></label>
        </div>
        <div className="row">
          <label className="field">Hiring manager <span className="optional">(optional)</span><input type="text" value={letter.hiringManager} onChange={set('hiringManager')} placeholder="Leave blank for Hiring Manager" /></label>
          <label className="field">Tone
            <select value={letter.tone} onChange={set('tone')}>
              {TONES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
            </select>
          </label>
        </div>
        <div className="letter-actions">
          <button className="btn primary" onClick={onWrite} disabled={!canWrite}>
            {letter.loading ? 'Writing your letter…' : letter.text ? 'Write a new version' : 'Write my cover letter'}
          </button>
          {!hasJobDesc && <span className="muted small">Tip: paste the job description on the left for a stronger letter.</span>}
        </div>
        {letter.loading && <p className="status busy" role="status">This can take up to a minute.</p>}
        {letter.error && <p className="status error" role="alert">{letter.error}</p>}
      </div>

      {letter.text ? (
        <article className="paper letter-paper" aria-label="Cover letter">
          <header className="doc-head">
            <div>
              <h1>{resume.name}</h1>
              {resume.title && <p className="doc-title">{resume.title}</p>}
            </div>
            <div className="doc-contact">
              {contact && <div>{contact}</div>}
              {resume.links?.length > 0 && <div>{resume.links.join(' · ')}</div>}
            </div>
          </header>
          <p className="letter-date">{today}</p>
          <textarea
            className="letter-body"
            aria-label="Cover letter text. You can edit it."
            value={letter.text}
            onChange={set('text')}
            rows={Math.max(14, letter.text.split('\n').length + 4)}
          />
          <div className="letter-print">
            {letter.text.trim().split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}{line}</span>)}</p>
            ))}
          </div>
        </article>
      ) : (
        <div className="card placeholder small-placeholder">
          <h2>Your cover letter will show up here</h2>
          <p>Gemini writes it from your fixed resume and the job description. You can edit every word before you download or print it.</p>
        </div>
      )}
    </>
  );
}
