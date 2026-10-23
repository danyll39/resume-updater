import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../app.js';
import { resumeDocx } from '../frontend/src/lib/docx.js';

// A fake Gemini client: records every request and answers with whatever the test sets.
function fakeGemini() {
  const fake = {
    calls: [],
    reply: () => ({ text: '{}' }),
    models: {
      generateContent: async (request) => {
        fake.calls.push(request);
        return fake.reply(request);
      }
    }
  };
  return fake;
}

const quietLogger = { error() {} };

const FIXED = {
  resume: { name: '  Ada Example ', summary: 'Builds apps.', skills: [{ group: 'Front End', items: ['React'] }], experience: [{ company: 'Acme', role: 'Dev', bullets: ['Shipped it.'] }] },
  changes: [
    { section: 'Experience', before: 'Did stuff.', after: 'Shipped it.', reason: 'Stronger verb.' },
    { section: 'Skills', before: 'React', after: 'React', reason: 'No change' }
  ],
  issues: ['Add dates to each job.', 42],
  job: { company: ' Brightpath ', title: 'Front-End Developer' },
  jobKeywords: [{ term: 'React', aliases: ['React.js'] }, { term: 'react' }, { term: 'TypeScript' }]
};

async function start(options) {
  const app = createApp({ model: 'test-model', logger: quietLogger, ...options });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base };
}

function form(fields) {
  const f = new FormData();
  for (const [key, value] of Object.entries(fields)) f.append(key, value);
  return f;
}

const postForm = (base, fields) => fetch(`${base}/api/fix`, { method: 'POST', body: form(fields) });
const postJson = (base, path, body) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('server', () => {
  let ai;
  let server;
  let base;

  beforeAll(async () => {
    ai = fakeGemini();
    ({ server, base } = await start({ ai, limits: { fix: 100, letter: 100 } }));
  });

  afterAll(() => server.close());

  beforeEach(() => {
    ai.calls = [];
    ai.reply = () => ({ text: JSON.stringify(FIXED) });
  });

  describe('GET /api/health', () => {
    it('reports the model and whether a key is set', async () => {
      const res = await fetch(`${base}/api/health`);
      expect(await res.json()).toEqual({ ok: true, aiReady: true, model: 'test-model' });
    });
  });

  describe('POST /api/fix', () => {
    it('fixes pasted text and cleans up the reply', async () => {
      const res = await postForm(base, { resumeText: 'Ada Example. Did stuff.', jobDesc: 'React developer wanted' });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.resume.name).toBe('Ada Example');
      expect(data.resume.projects).toEqual([]);
      expect(data.changes).toHaveLength(1); // the no-op change is removed
      expect(data.issues).toEqual(['Add dates to each job.']); // non-text tip removed
      expect(data.job).toEqual({ company: 'Brightpath', title: 'Front-End Developer' });
      expect(data.jobKeywords.map((k) => k.term)).toEqual(['React', 'TypeScript']); // duplicate removed
    });

    it('sends Gemini the resume, the job description, and the JSON schema', async () => {
      await postForm(base, { resumeText: 'Ada Example. Did stuff.', jobDesc: 'React developer wanted' });
      const request = ai.calls[0];
      expect(request.model).toBe('test-model');
      expect(request.config.responseMimeType).toBe('application/json');
      expect(request.config.responseSchema).toBeTruthy();
      const texts = request.contents[0].parts.map((p) => p.text).join('\n');
      expect(texts).toContain('RESUME:\nAda Example. Did stuff.');
      expect(texts).toContain('React developer wanted');
    });

    it('returns no keywords when there is no job description', async () => {
      const data = await (await postForm(base, { resumeText: 'Ada Example' })).json();
      expect(data.jobKeywords).toEqual([]);
      expect(ai.calls[0].contents[0].parts[1].text).toContain('No job description was provided');
    });

    it('reads an uploaded Word file and sends its text', async () => {
      const resume = { name: 'Grace Hopper', title: '', location: '', phone: '', email: '', links: [], summary: 'Wrote compilers.', skills: [], experience: [], projects: [], education: [] };
      const blob = resumeDocx(resume);
      const res = await postForm(base, { resume: new File([blob], 'resume.docx', { type: blob.type }) });
      expect(res.status).toBe(200);
      expect(ai.calls[0].contents[0].parts[0].text).toContain('Grace Hopper');
      expect(ai.calls[0].contents[0].parts[0].text).toContain('Wrote compilers.');
    });

    it('sends an uploaded PDF to Gemini as a file', async () => {
      const pdf = new File([Buffer.from('%PDF-1.4 test')], 'resume.pdf', { type: 'application/pdf' });
      await postForm(base, { resume: pdf });
      const part = ai.calls[0].contents[0].parts[0];
      expect(part.inlineData.mimeType).toBe('application/pdf');
      expect(Buffer.from(part.inlineData.data, 'base64').toString()).toBe('%PDF-1.4 test');
    });

    it('rejects file types it cannot read', async () => {
      const res = await postForm(base, { resume: new File(['MZ'], 'virus.exe', { type: 'application/octet-stream' }) });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/PDF, Word/);
      expect(ai.calls).toHaveLength(0);
    });

    it('rejects a request with no resume', async () => {
      const res = await postForm(base, { jobDesc: 'Only a job' });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Upload a resume file or paste/);
    });

    it('rejects files over 5 MB', async () => {
      const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
      const res = await postForm(base, { resume: big });
      expect(res.status).toBe(413);
      expect(ai.calls).toHaveLength(0);
    });

    it('explains when Gemini’s daily limit is reached', async () => {
      ai.reply = () => { throw Object.assign(new Error('quota'), { status: 429 }); };
      const res = await postForm(base, { resumeText: 'Ada' });
      expect(res.status).toBe(429);
      expect((await res.json()).error).toMatch(/daily limit/);
    });

    it('explains when the model name is wrong', async () => {
      ai.reply = () => { throw Object.assign(new Error('not found'), { status: 404 }); };
      const res = await postForm(base, { resumeText: 'Ada' });
      expect(res.status).toBe(502);
      expect((await res.json()).error).toMatch(/test-model/);
    });

    it('explains when the API key is rejected', async () => {
      ai.reply = () => { throw Object.assign(new Error('bad key'), { status: 403 }); };
      const res = await postForm(base, { resumeText: 'Ada' });
      expect((await res.json()).error).toMatch(/API key/);
    });

    it('handles a reply that is not valid JSON', async () => {
      ai.reply = () => ({ text: 'Sorry, I cannot help with that.' });
      const res = await postForm(base, { resumeText: 'Ada' });
      expect(res.status).toBe(502);
    });

    it('handles a reply with no resume in it', async () => {
      ai.reply = () => ({ text: JSON.stringify({ changes: [] }) });
      expect((await postForm(base, { resumeText: 'Ada' })).status).toBe(502);
    });
  });

  describe('POST /api/cover-letter', () => {
    const resume = { name: 'Ada Example', summary: 'Builds apps.', skills: [], experience: [] };

    it('writes a letter and removes Markdown bold marks', async () => {
      ai.reply = () => ({ text: 'Dear Hiring Manager,\n\nI **love** React.\n\nSincerely,\nAda Example' });
      const res = await postJson(base, '/api/cover-letter', { resume, jobDesc: 'React job', company: 'Brightpath', jobTitle: 'Developer', tone: 'warm' });
      expect(res.status).toBe(200);
      expect((await res.json()).letter).toBe('Dear Hiring Manager,\n\nI love React.\n\nSincerely,\nAda Example');
    });

    it('passes the company, title, manager, and tone to Gemini', async () => {
      ai.reply = () => ({ text: 'Letter' });
      await postJson(base, '/api/cover-letter', { resume, jobDesc: 'React job', company: 'Brightpath', jobTitle: 'Developer', hiringManager: 'Ms. Rivera', tone: 'confident' });
      const details = ai.calls[0].contents[0].parts[0].text;
      expect(details).toContain('Company: Brightpath');
      expect(details).toContain('Job title: Developer');
      expect(details).toContain('Address the letter to: Ms. Rivera');
      expect(details).toContain('Tone: confident');
    });

    it('falls back to a professional tone for unknown tones', async () => {
      ai.reply = () => ({ text: 'Letter' });
      await postJson(base, '/api/cover-letter', { resume, jobTitle: 'Developer', tone: 'sarcastic' });
      expect(ai.calls[0].contents[0].parts[0].text).toContain('Tone: professional');
    });

    it('needs a resume', async () => {
      const res = await postJson(base, '/api/cover-letter', { jobDesc: 'React job' });
      expect(res.status).toBe(400);
      expect(ai.calls).toHaveLength(0);
    });

    it('needs a job description or a job title', async () => {
      const res = await postJson(base, '/api/cover-letter', { resume });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/job description or at least a job title/);
    });

    it('handles an empty reply from Gemini', async () => {
      ai.reply = () => ({ text: '   ' });
      const res = await postJson(base, '/api/cover-letter', { resume, jobTitle: 'Developer' });
      expect(res.status).toBe(502);
    });
  });

  describe('POST /resume-updater (original v1 route)', () => {
    it('still returns Markdown', async () => {
      ai.reply = () => ({ text: '# Ada Example' });
      const res = await postJson(base, '/resume-updater', { resumeText: 'Ada', jobDesc: 'Job' });
      expect(await res.json()).toEqual({ updatedResume: '# Ada Example' });
    });

    it('needs both fields', async () => {
      expect((await postJson(base, '/resume-updater', { resumeText: 'Ada' })).status).toBe(400);
    });
  });
});

describe('server without an API key', () => {
  let server;
  let base;
  let ai;

  beforeAll(async () => {
    ai = fakeGemini();
    ({ server, base } = await start({ ai, aiReady: false }));
  });
  afterAll(() => server.close());

  it('says the key is missing instead of calling Gemini', async () => {
    const res = await postForm(base, { resumeText: 'Ada' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/GEMINI_API_KEY/);
    expect(ai.calls).toHaveLength(0);
  });
});

describe('rate limits', () => {
  let server;
  let base;
  let ai;

  beforeAll(async () => {
    ai = fakeGemini();
    ai.reply = () => ({ text: JSON.stringify(FIXED) });
    ({ server, base } = await start({ ai, limits: { fix: 2, letter: 1 } }));
  });
  afterAll(() => server.close());

  it('blocks a visitor after too many fixes', async () => {
    expect((await postForm(base, { resumeText: 'Ada' })).status).toBe(200);
    expect((await postForm(base, { resumeText: 'Ada' })).status).toBe(200);
    const res = await postForm(base, { resumeText: 'Ada' });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/Wait 15 minutes/);
  });

  it('does not count requests that never reach Gemini', async () => {
    const before = ai.calls.length;
    await postForm(base, { jobDesc: 'No resume' });
    expect(ai.calls.length).toBe(before);
  });

  it('limits cover letters separately', async () => {
    ai.reply = () => ({ text: 'Letter' });
    const body = { resume: { name: 'Ada' }, jobTitle: 'Developer' };
    expect((await postJson(base, '/api/cover-letter', body)).status).toBe(200);
    expect((await postJson(base, '/api/cover-letter', body)).status).toBe(429);
  });
});

describe('serving the website in production', () => {
  let server;
  let base;
  let dir;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'site-'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Resume Updater</title>');
    writeFileSync(path.join(dir, 'app.js'), 'console.log("hi")');
    ({ server, base } = await start({ ai: fakeGemini(), staticDir: dir }));
  });
  afterAll(() => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves the home page', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Resume Updater</title>');
  });

  it('serves built files', async () => {
    const res = await fetch(`${base}/app.js`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('console.log');
  });

  it('sends other page addresses to the React app', async () => {
    expect(await (await fetch(`${base}/some/page`)).text()).toContain('<title>Resume Updater</title>');
  });

  it('still answers API requests with JSON', async () => {
    expect((await (await fetch(`${base}/api/health`)).json()).ok).toBe(true);
    const missing = await fetch(`${base}/api/nope`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Not found.' });
  });
});

describe('without a built website', () => {
  it('runs the API only', async () => {
    const { server, base } = await start({ ai: fakeGemini(), staticDir: path.join(tmpdir(), 'does-not-exist') });
    try {
      expect((await fetch(`${base}/`)).status).toBe(404);
      expect((await (await fetch(`${base}/api/health`)).json()).ok).toBe(true);
    } finally {
      server.close();
    }
  });
});
