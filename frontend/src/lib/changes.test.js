import { describe, it, expect } from 'vitest';
import { swapText } from './changes.js';

function makeResume() {
  return {
    name: 'Ada Example',
    title: 'Support Specialist',
    summary: 'Helps customers.',
    skills: [{ group: 'Tools', items: ['Git', 'Jira'] }],
    experience: [
      { company: 'Acme', role: 'Support', location: '', dates: '', bullets: ['Resolve 75+ tickets a week.', 'Train new hires.'] }
    ],
    projects: [{ name: 'App', tech: 'React', description: 'A small app.' }],
    education: [{ school: 'State U', credential: 'Certificate', dates: '', detail: 'Web development.' }]
  };
}

describe('swapText', () => {
  it('replaces a bullet that matches exactly', () => {
    const { resume, ok } = swapText(makeResume(), 'Train new hires.', 'Trained 5 new hires.');
    expect(ok).toBe(true);
    expect(resume.experience[0].bullets).toEqual(['Resolve 75+ tickets a week.', 'Trained 5 new hires.']);
  });

  it('ignores differences in spacing and capital letters', () => {
    const { resume, ok } = swapText(makeResume(), '  helps   CUSTOMERS. ', 'Supports customers.');
    expect(ok).toBe(true);
    expect(resume.summary).toBe('Supports customers.');
  });

  it('treats a skill group as one comma-separated line', () => {
    const { resume, ok } = swapText(makeResume(), 'Git, Jira', 'Git, GitHub, Jira');
    expect(ok).toBe(true);
    expect(resume.skills[0].items).toEqual(['Git', 'GitHub', 'Jira']);
  });

  it('can change the title, a project description, and education details', () => {
    let r = makeResume();
    r = swapText(r, 'Support Specialist', 'Technical Support Specialist').resume;
    r = swapText(r, 'A small app.', 'A React app for tracking tasks.').resume;
    r = swapText(r, 'Web development.', 'Full-stack web development.').resume;
    expect(r.title).toBe('Technical Support Specialist');
    expect(r.projects[0].description).toBe('A React app for tracking tasks.');
    expect(r.education[0].detail).toBe('Full-stack web development.');
  });

  it('removes a bullet when the replacement is empty', () => {
    const { resume, ok } = swapText(makeResume(), 'Train new hires.', '');
    expect(ok).toBe(true);
    expect(resume.experience[0].bullets).toEqual(['Resolve 75+ tickets a week.']);
  });

  it('removes a skill group that ends up empty', () => {
    const { resume } = swapText(makeResume(), 'Git, Jira', '');
    expect(resume.skills).toHaveLength(0);
  });

  it('reports failure and leaves the resume alone when the text is not found', () => {
    const original = makeResume();
    const { resume, ok } = swapText(original, 'Text that is not there', 'New text');
    expect(ok).toBe(false);
    expect(resume).toBe(original);
  });

  it('reports failure when there is nothing to look for', () => {
    expect(swapText(makeResume(), '', 'New bullet').ok).toBe(false);
  });

  it('never changes the resume it was given', () => {
    const original = makeResume();
    const snapshot = JSON.stringify(original);
    swapText(original, 'Train new hires.', 'Changed.');
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
