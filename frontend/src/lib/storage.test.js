import { describe, it, expect, beforeEach } from 'vitest';
import { loadVersions, saveVersion, deleteVersion } from './storage.js';

// A tiny stand-in for the browser's localStorage.
function fakeStorage({ failWrites = false } = {}) {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      if (failWrites) throw new Error('QuotaExceededError');
      data.set(k, String(v));
    },
    removeItem: (k) => data.delete(k)
  };
}

const version = (id, name = `Version ${id}`) => ({ id, name, savedAt: new Date().toISOString() });

describe('saved versions', () => {
  beforeEach(() => {
    globalThis.localStorage = fakeStorage();
  });

  it('starts empty', () => {
    expect(loadVersions()).toEqual([]);
  });

  it('saves versions newest first', () => {
    saveVersion(version('a'));
    saveVersion(version('b'));
    expect(loadVersions().map((v) => v.id)).toEqual(['b', 'a']);
  });

  it('updates a version with the same id instead of adding a copy', () => {
    saveVersion(version('a', 'First name'));
    saveVersion(version('b'));
    saveVersion(version('a', 'Renamed'));
    const list = loadVersions();
    expect(list.map((v) => v.id)).toEqual(['a', 'b']);
    expect(list[0].name).toBe('Renamed');
  });

  it('keeps at most 20 versions', () => {
    for (let i = 0; i < 25; i++) saveVersion(version(String(i)));
    const list = loadVersions();
    expect(list).toHaveLength(20);
    expect(list[0].id).toBe('24');
  });

  it('deletes a version', () => {
    saveVersion(version('a'));
    saveVersion(version('b'));
    expect(deleteVersion('a').map((v) => v.id)).toEqual(['b']);
    expect(loadVersions().map((v) => v.id)).toEqual(['b']);
  });

  it('returns an empty list when saved data is corrupted', () => {
    globalThis.localStorage.setItem('resume-updater:versions', '{not json');
    expect(loadVersions()).toEqual([]);
  });

  it('returns null instead of crashing when the browser blocks saving', () => {
    globalThis.localStorage = fakeStorage({ failWrites: true });
    expect(saveVersion(version('a'))).toBeNull();
  });

  it('returns an empty list when storage is not available at all', () => {
    delete globalThis.localStorage;
    expect(loadVersions()).toEqual([]);
  });
});
