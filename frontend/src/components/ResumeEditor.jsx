import { clone } from '../lib/resumeText.js';

const splitList = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
const splitLines = (v) => v.split('\n').map((x) => x.trim()).filter(Boolean);

function Field({ label, value, onChange, rows }) {
  return (
    <label className="field">
      {label}
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

// Lists (skills, bullets) are edited as text and parsed only when the field loses focus,
// so typing a comma or a new line doesn't fight the cursor.
function ListField({ label, items, separator, rows, onCommit }) {
  const text = items.join(separator === ',' ? ', ' : '\n');
  return (
    <label className="field">
      {label}
      <textarea
        key={text}
        rows={rows || 2}
        defaultValue={text}
        onBlur={(e) => onCommit(separator === ',' ? splitList(e.target.value) : splitLines(e.target.value))}
      />
    </label>
  );
}

export default function ResumeEditor({ resume, onChange, onDone }) {
  const update = (fn) => {
    const next = clone(resume);
    fn(next);
    onChange(next);
  };

  return (
    <div className="card editor">
      <div className="editor-head">
        <h2>Edit your resume</h2>
        <button className="btn primary" onClick={onDone}>Done editing</button>
      </div>
      <p className="muted small">Changes show up in the preview, match score, and downloads right away. Lists save when you click out of the box.</p>

      <details open>
        <summary>Contact</summary>
        <div className="row">
          <Field label="Name" value={resume.name} onChange={(v) => update((r) => { r.name = v; })} />
          <Field label="Title line" value={resume.title} onChange={(v) => update((r) => { r.title = v; })} />
        </div>
        <div className="row">
          <Field label="Location" value={resume.location} onChange={(v) => update((r) => { r.location = v; })} />
          <Field label="Phone" value={resume.phone} onChange={(v) => update((r) => { r.phone = v; })} />
        </div>
        <Field label="Email" value={resume.email} onChange={(v) => update((r) => { r.email = v; })} />
        <ListField label="Links (separate with commas)" items={resume.links} separator="," onCommit={(v) => update((r) => { r.links = v; })} />
      </details>

      <details open>
        <summary>Summary</summary>
        <Field label="Summary" rows={4} value={resume.summary} onChange={(v) => update((r) => { r.summary = v; })} />
      </details>

      <details>
        <summary>Skills</summary>
        {resume.skills.map((g, i) => (
          <div className="row skill-row" key={i}>
            <Field label="Group" value={g.group} onChange={(v) => update((r) => { r.skills[i].group = v; })} />
            <ListField label="Skills (separate with commas)" items={g.items} separator="," onCommit={(v) => update((r) => { r.skills[i].items = v; })} />
          </div>
        ))}
        <button className="btn small-btn" onClick={() => update((r) => { r.skills.push({ group: 'New group', items: [] }); })}>Add skill group</button>
      </details>

      <details>
        <summary>Experience</summary>
        {resume.experience.map((x, i) => (
          <fieldset key={i}>
            <legend>{x.company || 'Job'}</legend>
            <div className="row">
              <Field label="Company" value={x.company} onChange={(v) => update((r) => { r.experience[i].company = v; })} />
              <Field label="Role" value={x.role} onChange={(v) => update((r) => { r.experience[i].role = v; })} />
            </div>
            <div className="row">
              <Field label="Location" value={x.location} onChange={(v) => update((r) => { r.experience[i].location = v; })} />
              <Field label="Dates" value={x.dates} onChange={(v) => update((r) => { r.experience[i].dates = v; })} />
            </div>
            <ListField label="Bullet points (one per line)" items={x.bullets} separator="line" rows={5} onCommit={(v) => update((r) => { r.experience[i].bullets = v; })} />
            <button className="btn ghost small-btn" onClick={() => update((r) => { r.experience.splice(i, 1); })}>Remove this job</button>
          </fieldset>
        ))}
        <button className="btn small-btn" onClick={() => update((r) => { r.experience.push({ company: '', role: '', location: '', dates: '', bullets: [] }); })}>Add a job</button>
      </details>

      <details>
        <summary>Projects</summary>
        {resume.projects.map((p, i) => (
          <fieldset key={i}>
            <legend>{p.name || 'Project'}</legend>
            <div className="row">
              <Field label="Name" value={p.name} onChange={(v) => update((r) => { r.projects[i].name = v; })} />
              <Field label="Tech" value={p.tech} onChange={(v) => update((r) => { r.projects[i].tech = v; })} />
            </div>
            <Field label="Description" rows={3} value={p.description} onChange={(v) => update((r) => { r.projects[i].description = v; })} />
            <button className="btn ghost small-btn" onClick={() => update((r) => { r.projects.splice(i, 1); })}>Remove this project</button>
          </fieldset>
        ))}
        <button className="btn small-btn" onClick={() => update((r) => { r.projects.push({ name: '', tech: '', description: '' }); })}>Add a project</button>
      </details>

      <details>
        <summary>Education</summary>
        {resume.education.map((e, i) => (
          <fieldset key={i}>
            <legend>{e.school || 'School'}</legend>
            <div className="row">
              <Field label="School" value={e.school} onChange={(v) => update((r) => { r.education[i].school = v; })} />
              <Field label="Dates" value={e.dates} onChange={(v) => update((r) => { r.education[i].dates = v; })} />
            </div>
            <Field label="Degree or certificate" value={e.credential} onChange={(v) => update((r) => { r.education[i].credential = v; })} />
            <Field label="Details" rows={2} value={e.detail} onChange={(v) => update((r) => { r.education[i].detail = v; })} />
          </fieldset>
        ))}
        <button className="btn small-btn" onClick={() => update((r) => { r.education.push({ school: '', credential: '', dates: '', detail: '' }); })}>Add education</button>
      </details>
    </div>
  );
}
