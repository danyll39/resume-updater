import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import UploadBox from './components/UploadBox.jsx';
import ResumePreview from './components/ResumePreview.jsx';
import ResumeEditor from './components/ResumeEditor.jsx';
import ChangeList from './components/ChangeList.jsx';
import MatchPanel from './components/MatchPanel.jsx';
import CoverLetter from './components/CoverLetter.jsx';
import VersionsPanel from './components/VersionsPanel.jsx';
import { resumeToText } from './lib/resumeText.js';
import { computeMatch } from './lib/match.js';
import { swapText } from './lib/changes.js';
import { loadVersions, saveVersion, deleteVersion } from './lib/storage.js';
import { resumeDocx, letterDocx, downloadBlob } from './lib/docx.js';

const MAX_BYTES = 5 * 1024 * 1024;
// In development, Vite forwards /api to the Express server (see vite.config.js).
const API_URL = import.meta.env.VITE_API_URL || '';

const EMPTY_LETTER = { company: '', jobTitle: '', hiringManager: '', tone: 'professional', text: '', loading: false, error: '' };

function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fileSafe(s) {
  return (s || 'Resume').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'Resume';
}

async function postJson(url, body, isForm) {
  let res;
  try {
    res = await fetch(`${API_URL}${url}`, isForm
      ? { method: 'POST', body }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach the server. Start it with npm run dev and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

export default function App() {
  // Input
  const [mode, setMode] = useState('upload'); // 'upload' | 'paste'
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Results
  const [result, setResult] = useState(null); // { resume, changes, issues, jobKeywords, job }
  const [view, setView] = useState('resume'); // resume | changes | match | letter | tips
  const [editing, setEditing] = useState(false);
  const [letter, setLetter] = useState(EMPTY_LETTER);

  // Saved versions
  const [versions, setVersions] = useState(() => loadVersions());
  const [activeId, setActiveId] = useState(null);

  // Small status messages
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const notify = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const match = useMemo(() => (result ? computeMatch(result.resume, result.jobKeywords) : null), [result]);
  const hasInput = mode === 'upload' ? Boolean(file) : resumeText.trim().length > 0;

  // ---------- fixing ----------
  const chooseFile = (f) => {
    setError('');
    if (f.size > MAX_BYTES) {
      setFile(null);
      setError('That file is over 5 MB. Upload a smaller file.');
      return;
    }
    setFile(f);
  };

  const handleFix = async () => {
    setLoading(true);
    setError('');
    const form = new FormData();
    if (mode === 'upload') form.append('resume', file);
    else form.append('resumeText', resumeText);
    if (jobDesc.trim()) form.append('jobDesc', jobDesc);

    try {
      const data = await postJson('/api/fix', form, true);
      setResult({
        resume: data.resume,
        changes: data.changes.map((c) => ({ ...c, status: 'accepted' })),
        issues: data.issues,
        jobKeywords: data.jobKeywords || [],
        job: data.job || { company: '', title: '' }
      });
      setLetter({ ...EMPTY_LETTER, company: data.job?.company || '', jobTitle: data.job?.title || '' });
      setActiveId(null);
      setEditing(false);
      setView('resume');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- accepting and undoing changes ----------
  const applyStatus = (state, i, status) => {
    const c = state.changes[i];
    if (c.status === status) return state;
    const [from, to] = status === 'rejected' ? [c.after, c.before] : [c.before, c.after];
    const { resume, ok } = swapText(state.resume, from, to);
    const changes = state.changes.slice();
    if (!ok) {
      changes[i] = {
        ...c,
        note: !from
          ? "This was a new addition, so it can't be put back automatically. Add it in Edit if you want it."
          : "You've edited this text since, so it can't be switched automatically. Change it in Edit instead."
      };
      return { ...state, changes };
    }
    changes[i] = { ...c, status, note: '' };
    return { ...state, resume, changes };
  };

  const setChangeStatus = (i, status) => setResult((r) => applyStatus(r, i, status));
  const setAllStatus = (status) => setResult((r) => r.changes.reduce((acc, _, i) => applyStatus(acc, i, status), r));

  // ---------- cover letter ----------
  const writeLetter = async () => {
    setLetter((l) => ({ ...l, loading: true, error: '' }));
    try {
      const data = await postJson('/api/cover-letter', {
        resume: result.resume,
        jobDesc,
        company: letter.company,
        jobTitle: letter.jobTitle,
        hiringManager: letter.hiringManager,
        tone: letter.tone
      });
      setLetter((l) => ({ ...l, text: data.letter, loading: false }));
    } catch (err) {
      setLetter((l) => ({ ...l, loading: false, error: err.message }));
    }
  };

  // ---------- versions ----------
  const versionName = () => {
    const role = letter.jobTitle || result.job?.title;
    const company = letter.company || result.job?.company;
    if (role && company) return `${role} at ${company}`;
    return role || company || (file && mode === 'upload' ? file.name.replace(/\.[^.]+$/, '') : 'My resume');
  };

  const handleSave = () => {
    const id = activeId || newId();
    const list = saveVersion({
      id,
      name: versionName(),
      savedAt: new Date().toISOString(),
      score: match ? match.score : null,
      jobDesc,
      result,
      letter: { ...letter, loading: false, error: '' }
    });
    if (!list) {
      notify("Couldn't save. Your browser may be blocking storage.");
      return;
    }
    setVersions(list);
    setActiveId(id);
    notify(activeId ? 'Version updated' : 'Version saved');
  };

  const handleLoad = (v) => {
    setResult(v.result);
    setLetter({ ...EMPTY_LETTER, ...v.letter });
    setJobDesc(v.jobDesc || '');
    setActiveId(v.id);
    setEditing(false);
    setView('resume');
    setError('');
    notify(`Opened "${v.name}"`);
  };

  const handleDelete = (v) => {
    setVersions(deleteVersion(v.id));
    if (activeId === v.id) setActiveId(null);
    notify(`Deleted "${v.name}"`);
  };

  // ---------- output ----------
  const showingLetter = view === 'letter' && letter.text;
  const baseName = fileSafe(result?.resume.name);

  const handleDownload = () => {
    if (showingLetter) {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      downloadBlob(letterDocx(result.resume, letter.text, today), `${baseName}_Cover_Letter.docx`);
    } else {
      downloadBlob(resumeDocx(result.resume), `${baseName}_Resume.docx`);
    }
    notify('Word file downloaded');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(showingLetter ? letter.text : resumeToText(result.resume));
      notify('Copied');
    } catch {
      notify("Your browser blocked copying. Select the text and copy it instead.");
    }
  };

  const handlePrint = () => {
    if (view !== 'resume' && !showingLetter) {
      setView('resume');
      setTimeout(() => window.print(), 80);
    } else {
      window.print();
    }
  };

  const startOver = () => {
    setResult(null);
    setFile(null);
    setResumeText('');
    setLetter(EMPTY_LETTER);
    setActiveId(null);
    setEditing(false);
    setError('');
  };

  const tabs = result ? [
    ['resume', 'Resume'],
    ['changes', `Changes (${result.changes.length})`],
    ['match', match ? `Job match ${match.score}%` : 'Job match'],
    ['letter', 'Cover letter'],
    ['tips', `Tips (${result.issues.length})`]
  ] : [];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Resume Updater</h1>
        <p>Upload your resume and Gemini will fix the grammar, strengthen your bullet points, and match the wording to a job, without making anything up.</p>
      </header>

      <main className="layout">
        <div className="side">
          <section className="card input-card" aria-label="Your resume">
            <div className="seg" role="tablist" aria-label="How to add your resume">
              <button role="tab" aria-selected={mode === 'upload'} onClick={() => setMode('upload')}>Upload a file</button>
              <button role="tab" aria-selected={mode === 'paste'} onClick={() => setMode('paste')}>Paste text</button>
            </div>

            {mode === 'upload' ? (
              <UploadBox file={file} onFile={chooseFile} disabled={loading} />
            ) : (
              <label className="field">
                Resume text
                <textarea rows={10} value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume here" />
              </label>
            )}

            <label className="field">
              Job description <span className="optional">(optional, but needed for the match score)</span>
              <textarea rows={7} value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} placeholder="Paste a job posting to match your wording to it" />
            </label>

            <aside className="notice" aria-labelledby="notice-title">
              <h2 id="notice-title">Don't upload sensitive information</h2>
              <p>Your resume is sent to Google Gemini for review. On Gemini's free tier, Google may keep what you send, use it to improve its products, and have people read it. Before you upload, remove:</p>
              <ul>
                <li>Social Security, driver's license, or passport numbers</li>
                <li>Date of birth and your full home address (city and state are enough)</li>
                <li>Bank, salary, or health details</li>
                <li>References' names and contact details</li>
              </ul>
              <label className="agree">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                I've removed sensitive information and understand my resume will be sent to Google Gemini.
              </label>
            </aside>

            <button className="btn primary wide" onClick={handleFix} disabled={loading || !hasInput || !agreed}>
              {loading ? 'Gemini is reviewing your resume…' : 'Fix my resume'}
            </button>
            {!agreed && hasInput && <p className="status hint">Check the box above to continue.</p>}
            {loading && <p className="status busy" role="status">This can take up to a minute.</p>}
            {error && <p className="status error" role="alert">{error}</p>}
          </section>

          <VersionsPanel versions={versions} activeId={activeId} onLoad={handleLoad} onDelete={handleDelete} />
        </div>

        <section className="results" aria-label="Results">
          {!result ? (
            <div className="card placeholder">
              <h2>Your fixed resume will show up here</h2>
              <p>You'll see the improved resume, every change Gemini made and why, how well it matches the job, a cover letter, and tips.</p>
            </div>
          ) : (
            <>
              <div className="results-bar">
                <div className="seg tabs" role="tablist" aria-label="Results">
                  {tabs.map(([key, label]) => (
                    <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}>{label}</button>
                  ))}
                </div>
                <div className="actions">
                  <button className="btn" onClick={handleSave}>{activeId ? 'Update version' : 'Save version'}</button>
                  <button className="btn" onClick={handleDownload}>{showingLetter ? 'Download letter (.docx)' : 'Download Word'}</button>
                  <button className="btn" onClick={handleCopy}>Copy text</button>
                  <button className="btn primary" onClick={handlePrint}>Print or save PDF</button>
                  <button className="btn ghost" onClick={startOver}>Start over</button>
                </div>
              </div>

              {view === 'resume' && (
                <>
                  {editing ? (
                    <ResumeEditor
                      resume={result.resume}
                      onChange={(resume) => setResult((r) => ({ ...r, resume }))}
                      onDone={() => setEditing(false)}
                    />
                  ) : (
                    <div className="edit-bar">
                      <button className="btn" onClick={() => setEditing(true)}>Edit resume</button>
                      {match && <span className="muted small">Job match: <strong>{match.score}%</strong></span>}
                    </div>
                  )}
                  <ResumePreview resume={result.resume} />
                </>
              )}
              {view === 'changes' && <ChangeList changes={result.changes} onSetStatus={setChangeStatus} onSetAll={setAllStatus} />}
              {view === 'match' && <MatchPanel match={match} onEdit={() => { setView('resume'); setEditing(true); }} />}
              {view === 'letter' && (
                <CoverLetter resume={result.resume} letter={letter} setLetter={setLetter} onWrite={writeLetter} hasJobDesc={Boolean(jobDesc.trim())} />
              )}
              {view === 'tips' && (
                <div className="card">
                  {result.issues.length ? (
                    <ul className="tips">{result.issues.map((t, i) => <li key={i}>{t}</li>)}</ul>
                  ) : (
                    <p className="empty">No extra tips. Your resume is in good shape.</p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
