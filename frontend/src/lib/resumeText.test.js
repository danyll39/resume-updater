import { describe, it, expect } from 'vitest';
import { resumeToText, clone } from './resumeText.js';

const full = {
  name: 'Ada Example',
  title: 'Developer',
  location: 'Hartford, CT',
  phone: '',
  email: 'ada@example.com',
  links: ['github.com/ada'],
  summary: 'Builds web apps.',
  skills: [{ group: 'Front End', items: ['HTML', 'CSS'] }],
  experience: [{ company: 'Acme', role: 'Developer', location: 'Remote', dates: '2022 – Present', bullets: ['Built things.'] }],
  projects: [{ name: 'Tracker', tech: 'React', description: 'Tracks tasks.' }],
  education: [{ school: 'State U', credential: 'B.S.', dates: '2020', detail: 'Honors.' }]
};

describe('resumeToText', () => {
  it('includes every section in order', () => {
    const text = resumeToText(full);
    const order = ['Ada Example', 'SUMMARY', 'SKILLS', 'EXPERIENCE', 'PROJECTS', 'EDUCATION'].map((s) => text.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('formats contact details, skills, jobs, and bullets', () => {
    const text = resumeToText(full);
    expect(text).toContain('Hartford, CT | ada@example.com | github.com/ada');
    expect(text).toContain('Front End: HTML, CSS');
    expect(text).toContain('Developer, Acme (Remote) | 2022 – Present');
    expect(text).toContain('- Built things.');
    expect(text).toContain('Tracker (React): Tracks tasks.');
    expect(text).toContain('B.S., State U, 2020. Honors.');
  });

  it('leaves out empty sections', () => {
    const text = resumeToText({ ...full, summary: '', skills: [], projects: [], education: [] });
    expect(text).not.toContain('SUMMARY');
    expect(text).not.toContain('SKILLS');
    expect(text).not.toContain('PROJECTS');
    expect(text).not.toContain('EDUCATION');
    expect(text).toContain('EXPERIENCE');
  });
});

describe('clone', () => {
  it('makes a deep copy', () => {
    const copy = clone(full);
    copy.skills[0].items.push('JS');
    expect(full.skills[0].items).toEqual(['HTML', 'CSS']);
  });
});
