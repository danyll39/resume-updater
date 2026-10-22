// Builds a Word (.docx) file in the browser with no extra packages.
// A .docx is a zip of XML files, so this writes the XML and zips it (stored, no compression).

const enc = new TextEncoder();

// ---------- zip ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  files.forEach(({ name, data }) => {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, nameBytes.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

// ---------- WordprocessingML ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function run({ text, bold, italic, color, size }) {
  const props = [
    bold && '<w:b/>',
    italic && '<w:i/>',
    color && `<w:color w:val="${color}"/>`,
    size && `<w:sz w:val="${size * 2}"/>`
  ].filter(Boolean).join('');
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

// p({ runs, after, before, bullet, rightTab, border })
function paragraph({ runs = [], after = 60, before = 0, bullet = false, rightTab = false, border = false }) {
  const props = [
    border && '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="D6DBE6"/></w:pBdr>',
    rightTab && '<w:tabs><w:tab w:val="right" w:pos="10080"/></w:tabs>',
    `<w:spacing w:before="${before}" w:after="${after}"/>`,
    bullet && '<w:ind w:left="300" w:hanging="200"/>'
  ].filter(Boolean).join('');
  const content = (bullet ? [{ text: '• ' }, ...runs] : runs)
    .map((r) => (r.tab ? '<w:r><w:tab/></w:r>' : r.br ? '<w:r><w:br/></w:r>' : run(r)))
    .join('');
  return `<w:p><w:pPr>${props}</w:pPr>${content}</w:p>`;
}

function document(paragraphs) {
  const body = paragraphs.map(paragraph).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="864" w:right="1080" w:bottom="864" w:left="1080" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:color w:val="161A23"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;

  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['word/document.xml', xml],
    ['word/styles.xml', styles]
  ];
  return zip(files.map(([name, text]) => ({ name, data: enc.encode(text) })));
}

const BLUE = '2457D6';
const MUTED = '555C6B';

function header(r) {
  const contact = [r.location, r.phone, r.email, ...(r.links || [])].filter(Boolean).join('  ·  ');
  return [
    { runs: [{ text: r.name, bold: true, size: 22 }], after: 0 },
    r.title && { runs: [{ text: r.title, bold: true, color: BLUE, size: 11 }], after: 40 },
    contact && { runs: [{ text: contact, color: MUTED, size: 9 }], after: 120, border: true }
  ].filter(Boolean);
}

const heading = (text) => ({ runs: [{ text: text.toUpperCase(), bold: true, color: BLUE, size: 9.5 }], before: 200, after: 80, border: true });

export function resumeDocx(r) {
  const ps = [...header(r)];
  if (r.summary) ps.push(heading('Summary'), { runs: [{ text: r.summary }] });
  if (r.skills?.length) {
    ps.push(heading('Skills'));
    r.skills.forEach((g) => ps.push({ runs: [{ text: `${g.group}: `, bold: true }, { text: g.items.join(', ') }], after: 20 }));
  }
  if (r.experience?.length) {
    ps.push(heading('Experience'));
    r.experience.forEach((x) => {
      ps.push({ runs: [{ text: x.company, bold: true }, { tab: true }, { text: x.dates || '', color: MUTED }], rightTab: true, before: 80, after: 0 });
      ps.push({ runs: [{ text: [x.role, x.location].filter(Boolean).join(' · '), color: MUTED }], after: 40 });
      x.bullets.forEach((b) => ps.push({ runs: [{ text: b }], bullet: true, after: 30 }));
    });
  }
  if (r.projects?.length) {
    ps.push(heading('Projects'));
    r.projects.forEach((p) => {
      ps.push({ runs: [{ text: p.name, bold: true }, p.tech && { text: `  ${p.tech}`, color: MUTED, size: 9 }].filter(Boolean), before: 60, after: 0 });
      ps.push({ runs: [{ text: p.description }] });
    });
  }
  if (r.education?.length) {
    ps.push(heading('Education'));
    r.education.forEach((e) => {
      ps.push({ runs: [{ text: e.school, bold: true }, e.credential && { text: ` · ${e.credential}` }, { tab: true }, { text: e.dates || '', color: MUTED }].filter(Boolean), rightTab: true, after: 0 });
      if (e.detail) ps.push({ runs: [{ text: e.detail }] });
    });
  }
  return document(ps);
}

export function letterDocx(r, letter, dateText) {
  const ps = [...header(r), { runs: [{ text: dateText }], before: 240, after: 240 }];
  letter.trim().split(/\n{2,}/).forEach((block) => {
    const lines = block.split('\n');
    ps.push({ runs: lines.flatMap((line, i) => (i ? [{ br: true }, { text: line }] : [{ text: line }])), after: 200 });
  });
  return document(ps);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
