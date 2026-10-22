// Saved versions live in this browser only (localStorage).
// Every read and write is wrapped because storage can be blocked, for example in private windows.
const KEY = 'resume-updater:versions';
const MAX_VERSIONS = 20;

export function loadVersions() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function saveVersion(version) {
  const list = [version, ...loadVersions().filter((v) => v.id !== version.id)].slice(0, MAX_VERSIONS);
  return write(list) ? list : null;
}

export function deleteVersion(id) {
  const list = loadVersions().filter((v) => v.id !== id);
  write(list);
  return list;
}
