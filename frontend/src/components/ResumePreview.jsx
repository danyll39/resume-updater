export default function ResumePreview({ resume: r }) {
  const contact = [r.location, r.phone, r.email].filter(Boolean).join(' · ');
  return (
    <article className="paper" aria-label="Resume">
      <header className="doc-head">
        <div>
          <h1>{r.name || 'Your name'}</h1>
          {r.title && <p className="doc-title">{r.title}</p>}
        </div>
        <div className="doc-contact">
          {contact && <div>{contact}</div>}
          {r.links?.length > 0 && <div>{r.links.join(' · ')}</div>}
        </div>
      </header>

      {r.summary && (
        <section>
          <h2>Summary</h2>
          <p>{r.summary}</p>
        </section>
      )}

      {r.skills?.length > 0 && (
        <section>
          <h2>Skills</h2>
          <dl className="doc-skills">
            {r.skills.map((g, i) => (
              <div key={`${g.group}-${i}`}>
                <dt>{g.group}</dt>
                <dd>{g.items.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {r.experience?.length > 0 && (
        <section>
          <h2>Experience</h2>
          {r.experience.map((x, i) => (
            <div className="doc-item" key={`${x.company}-${i}`}>
              <div className="doc-row">
                <strong>{x.company}</strong>
                <span>{x.dates}</span>
              </div>
              <div className="doc-sub">{[x.role, x.location].filter(Boolean).join(' · ')}</div>
              <ul>
                {x.bullets.map((b, j) => <li key={j}>{b}</li>)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {r.projects?.length > 0 && (
        <section>
          <h2>Projects</h2>
          {r.projects.map((p, i) => (
            <div className="doc-item" key={`${p.name}-${i}`}>
              <div><strong>{p.name}</strong> {p.tech && <span className="doc-tech">{p.tech}</span>}</div>
              <p>{p.description}</p>
            </div>
          ))}
        </section>
      )}

      {r.education?.length > 0 && (
        <section>
          <h2>Education</h2>
          {r.education.map((e, i) => (
            <div className="doc-item" key={`${e.school}-${i}`}>
              <div className="doc-row">
                <span><strong>{e.school}</strong>{e.credential && ` · ${e.credential}`}</span>
                <span>{e.dates}</span>
              </div>
              {e.detail && <p>{e.detail}</p>}
            </div>
          ))}
        </section>
      )}
    </article>
  );
}
