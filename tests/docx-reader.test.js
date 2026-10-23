import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { docxToText } from '../lib/docx.js';
import { resumeDocx } from '../frontend/src/lib/docx.js';

// Build a minimal compressed .docx (like Word saves) holding one document.xml.
function compressedDocx(xml) {
  const name = Buffer.from('word/document.xml');
  const raw = Buffer.from(xml);
  const data = deflateRawSync(raw);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const dir = Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50, 0);
  dir.writeUInt16LE(8, 10);
  dir.writeUInt32LE(data.length, 20);
  dir.writeUInt32LE(raw.length, 24);
  dir.writeUInt16LE(name.length, 28);
  dir.writeUInt32LE(0, 42);
  const dirStart = local.length + name.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(dir.length + name.length, 12);
  end.writeUInt32LE(dirStart, 16);
  return Buffer.concat([local, name, data, dir, name, end]);
}

const wrap = (body) => `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`;

describe('docxToText', () => {
  it('reads paragraphs, tabs, line breaks, and special characters from a compressed file', async () => {
    const xml = wrap(
      '<w:p><w:r><w:t>Ada Example</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Acme</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>2022</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Line one</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>Line two &amp; more &lt;3</w:t></w:r></w:p>'
    );
    const text = await docxToText(compressedDocx(xml));
    expect(text).toBe('Ada Example\nAcme\t2022\nLine one\nLine two & more <3');
  });

  it('reads the Word files this app downloads (uncompressed)', async () => {
    const resume = {
      name: 'Ada Example', title: 'Developer', location: '', phone: '', email: '', links: [], summary: 'Builds apps.',
      skills: [], experience: [{ company: 'Acme', role: 'Dev', location: '', dates: '', bullets: ['Shipped it.'] }],
      projects: [], education: []
    };
    const buffer = Buffer.from(await resumeDocx(resume).arrayBuffer());
    const text = await docxToText(buffer);
    expect(text).toContain('Ada Example');
    expect(text).toContain('Builds apps.');
    expect(text).toContain('Shipped it.');
  });

  it('throws on a file that is not a .docx', async () => {
    await expect(docxToText(Buffer.from('plain text, not a zip'))).rejects.toThrow();
  });
});
