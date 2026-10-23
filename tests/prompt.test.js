import { describe, it, expect } from 'vitest';
import { normalizeResume, normalizeChanges, normalizeKeywords, RESPONSE_SCHEMA } from '../lib/prompt.js';

describe('normalizeResume', () => {
  it('fills in every field so the app can always render the result', () => {
    const r = normalizeResume({ name: 'Ada' });
    expect(r).toEqual({
      name: 'Ada', title: '', location: '', phone: '', email: '', links: [], summary: '',
      skills: [], experience: [], projects: [], education: []
    });
  });

  it('works with nothing at all', () => {
    expect(normalizeResume().name).toBe('');
    expect(normalizeResume(undefined).skills).toEqual([]);
  });

  it('trims text and drops empty list items', () => {
    const r = normalizeResume({
      name: '  Ada  ',
      links: [' github.com/ada ', '', 42],
      skills: [{ group: ' Tools ', items: [' Git ', ''] }, { group: 'Empty', items: [] }, { items: ['Jira'] }],
      experience: [{ company: 'Acme', role: 'Dev', bullets: [' Did it. ', '', null] }]
    });
    expect(r.name).toBe('Ada');
    expect(r.links).toEqual(['github.com/ada']);
    expect(r.skills).toEqual([{ group: 'Tools', items: ['Git'] }, { group: 'Skills', items: ['Jira'] }]);
    expect(r.experience[0]).toEqual({ company: 'Acme', role: 'Dev', location: '', dates: '', bullets: ['Did it.'] });
  });
});

describe('normalizeChanges', () => {
  it('drops changes that change nothing or have no new text', () => {
    const list = normalizeChanges([
      { section: 'Summary', before: 'Old', after: 'New', reason: 'Clearer' },
      { section: 'Skills', before: 'Same', after: 'Same', reason: 'No-op' },
      { section: 'Bullet', before: 'Old', after: '', reason: 'Empty' }
    ]);
    expect(list).toEqual([{ section: 'Summary', before: 'Old', after: 'New', reason: 'Clearer' }]);
  });

  it('gives a default section name and keeps at most 60 changes', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ after: `Line ${i}` }));
    const list = normalizeChanges(many);
    expect(list).toHaveLength(60);
    expect(list[0].section).toBe('Resume');
  });

  it('returns an empty list for bad input', () => {
    expect(normalizeChanges(null)).toEqual([]);
  });
});

describe('normalizeKeywords', () => {
  it('removes duplicates regardless of capital letters', () => {
    const list = normalizeKeywords([{ term: 'React', aliases: ['React.js'] }, { term: 'react' }, { term: ' ' }]);
    expect(list).toEqual([{ term: 'React', aliases: ['React.js'] }]);
  });

  it('keeps at most 25 keywords and 5 aliases each', () => {
    const list = normalizeKeywords(Array.from({ length: 30 }, (_, i) => ({ term: `Skill ${i}`, aliases: ['a', 'b', 'c', 'd', 'e', 'f'] })));
    expect(list).toHaveLength(25);
    expect(list[0].aliases).toHaveLength(5);
  });
});

describe('RESPONSE_SCHEMA', () => {
  it('requires the parts the app depends on', () => {
    expect(RESPONSE_SCHEMA.required).toEqual(expect.arrayContaining(['resume', 'changes', 'issues', 'jobKeywords']));
    expect(RESPONSE_SCHEMA.properties.changes.items.required).toEqual(expect.arrayContaining(['before', 'after']));
  });
});
