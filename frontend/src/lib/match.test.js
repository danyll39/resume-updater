import { describe, it, expect } from 'vitest';
import { computeMatch } from './match.js';

const resume = {
  name: 'Ada Example',
  title: 'Front-End Developer',
  summary: 'Builds accessible React apps and troubleshoots customer issues.',
  skills: [{ group: 'Front End', items: ['HTML5', 'CSS3', 'JavaScript', 'React.js', 'C#'] }],
  experience: [{ company: 'Acme', role: 'Developer', location: '', dates: '', bullets: ['Built REST API integrations with Node.js.'] }],
  projects: [],
  education: []
};

describe('computeMatch', () => {
  it('returns null when the job has no keywords', () => {
    expect(computeMatch(resume, [])).toBeNull();
    expect(computeMatch(resume)).toBeNull();
  });

  it('scores the share of keywords found and lists matched and missing ones', () => {
    const result = computeMatch(resume, [{ term: 'JavaScript' }, { term: 'TypeScript' }, { term: 'Node.js' }, { term: 'Docker' }]);
    expect(result.matched).toEqual(['JavaScript', 'Node.js']);
    expect(result.missing).toEqual(['TypeScript', 'Docker']);
    expect(result.score).toBe(50);
  });

  it('counts a keyword as matched when only an alias appears', () => {
    const result = computeMatch(resume, [{ term: 'React', aliases: ['React.js'] }, { term: 'REST APIs', aliases: ['REST API'] }]);
    expect(result.matched).toEqual(['React', 'REST APIs']);
    expect(result.score).toBe(100);
  });

  it('matches whole words only, so "Java" does not match "JavaScript"', () => {
    const result = computeMatch(resume, [{ term: 'Java' }]);
    expect(result.missing).toEqual(['Java']);
    expect(result.score).toBe(0);
  });

  it('handles terms with symbols such as C#', () => {
    expect(computeMatch(resume, [{ term: 'C#' }]).matched).toEqual(['C#']);
  });

  it('is case-insensitive', () => {
    expect(computeMatch(resume, [{ term: 'javascript' }]).score).toBe(100);
  });

  it('updates when the resume changes', () => {
    const keywords = [{ term: 'TypeScript' }];
    expect(computeMatch(resume, keywords).score).toBe(0);
    const edited = { ...resume, skills: [{ group: 'Front End', items: ['TypeScript'] }] };
    expect(computeMatch(edited, keywords).score).toBe(100);
  });
});
