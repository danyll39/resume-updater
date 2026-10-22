import { clone } from './resumeText.js';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const splitList = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);

// Every editable text field in a resume, with a getter and setter.
function slots(r) {
  const list = [
    { get: () => r.title, set: (v) => { r.title = v; } },
    { get: () => r.summary, set: (v) => { r.summary = v; } }
  ];
  r.skills.forEach((g) => list.push({ get: () => g.items.join(', '), set: (v) => { g.items = splitList(v); } }));
  r.experience.forEach((x) => {
    list.push({ get: () => x.role, set: (v) => { x.role = v; } });
    x.bullets.forEach((_, i) => list.push({ get: () => x.bullets[i], set: (v) => { x.bullets[i] = v; } }));
  });
  r.projects.forEach((p) => list.push({ get: () => p.description, set: (v) => { p.description = v; } }));
  r.education.forEach((e) => list.push({ get: () => e.detail, set: (v) => { e.detail = v; } }));
  return list;
}

// Swap one field's text for another. Returns { resume, ok }.
// An empty replacement removes the field (used to reject a brand-new bullet).
export function swapText(resume, from, to) {
  const next = clone(resume);
  const target = norm(from);
  if (!target) return { resume, ok: false };
  const slot = slots(next).find((s) => norm(s.get()) === target);
  if (!slot) return { resume, ok: false };
  slot.set(to);
  next.experience.forEach((x) => { x.bullets = x.bullets.filter(Boolean); });
  next.skills = next.skills.filter((g) => g.items.length);
  return { resume: next, ok: true };
}
