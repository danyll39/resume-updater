// Plain-text version of a resume, used for Copy text and keyword matching.
export function resumeToText(r) {
  const lines = [r.name, r.title, [r.location, r.phone, r.email, ...(r.links || [])].filter(Boolean).join(' | '), ''];
  if (r.summary) lines.push('SUMMARY', r.summary, '');
  if (r.skills?.length) {
    lines.push('SKILLS');
    r.skills.forEach((g) => lines.push(`${g.group}: ${g.items.join(', ')}`));
    lines.push('');
  }
  if (r.experience?.length) {
    lines.push('EXPERIENCE');
    r.experience.forEach((x) => {
      lines.push(`${x.role}, ${x.company}${x.location ? ` (${x.location})` : ''}${x.dates ? ` | ${x.dates}` : ''}`);
      x.bullets.forEach((b) => lines.push(`- ${b}`));
      lines.push('');
    });
  }
  if (r.projects?.length) {
    lines.push('PROJECTS');
    r.projects.forEach((p) => lines.push(`${p.name}${p.tech ? ` (${p.tech})` : ''}: ${p.description}`));
    lines.push('');
  }
  if (r.education?.length) {
    lines.push('EDUCATION');
    r.education.forEach((e) => lines.push([e.credential, e.school, e.dates].filter(Boolean).join(', ') + (e.detail ? `. ${e.detail}` : '')));
  }
  return lines.join('\n').trim();
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
