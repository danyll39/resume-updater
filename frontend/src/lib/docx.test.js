import { describe, it, expect } from 'vitest';
import { resumeDocx, letterDocx } from './docx.js';

const resume = {
  name: 'Ada Example',
  title: 'Developer',
  location: 'Hartford, CT',
  phone: '',
  email: 'ada@example.com',
  links: [],
  summary: 'Builds web apps & fixes bugs <fast>.',
  skills: [{ group: 'Front End', items: ['HTML', 'CSS'] }],
  experience: [{ company: 'Acme', role: 'Developer', location: 'Remote', dates: '2022 – Present', bullets: ['Built things.'] }],
  projects: [],
  education: []
};

// Read the zip's file list straight from its central directory.
async function zipEntries(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buf.buffer);
  let end = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const entries = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    entries[name] = dec.decode(buf.subarray(start, start + size));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

describe('resumeDocx', () => {
  it('creates a Word file with the parts Word needs', async () => {
    const blob = resumeDocx(resume);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const files = Object.keys(await zipEntries(blob));
    expect(files).toEqual(expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml']));
  });

  it('includes the resume content', async () => {
    const xml = (await zipEntries(resumeDocx(resume)))['word/document.xml'];
    for (const text of ['Ada Example', 'Developer', 'Front End: ', 'HTML, CSS', 'Acme', 'Built things.']) {
      expect(xml).toContain(text);
    }
  });

  it('escapes characters that would break the XML', async () => {
    const xml = (await zipEntries(resumeDocx(resume)))['word/document.xml'];
    expect(xml).toContain('Builds web apps &amp; fixes bugs &lt;fast&gt;.');
    expect(xml).not.toContain('<fast>');
  });

  it('leaves out empty sections', async () => {
    const xml = (await zipEntries(resumeDocx(resume)))['word/document.xml'];
    expect(xml).not.toContain('PROJECTS');
    expect(xml).not.toContain('EDUCATION');
  });
});

describe('letterDocx', () => {
  it('turns blank lines into paragraphs and single new lines into line breaks', async () => {
    const letter = 'Dear Hiring Manager,\n\nFirst paragraph.\n\nSincerely,\nAda Example';
    const xml = (await zipEntries(letterDocx(resume, letter, 'October 22, 2026')))['word/document.xml'];
    expect(xml).toContain('October 22, 2026');
    expect(xml).toContain('First paragraph.');
    expect(xml).toMatch(/Sincerely,<\/w:t><\/w:r><w:r><w:br\/><\/w:r><w:r><w:t xml:space="preserve">Ada Example/);
  });
});
