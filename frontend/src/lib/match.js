import { resumeToText } from './resumeText.js';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word match that also works for terms like "C#", "Node.js", or "CI/CD".
function contains(text, term) {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(term.toLowerCase())}(?![a-z0-9])`, 'i');
  return re.test(text);
}

// Compare the job's keywords (picked out by Gemini) with the current resume.
// Runs in the browser, so the score updates as soon as the resume changes.
export function computeMatch(resume, keywords = []) {
  if (!keywords.length) return null;
  const text = resumeToText(resume).toLowerCase();
  const matched = [];
  const missing = [];
  keywords.forEach((k) => {
    const found = [k.term, ...(k.aliases || [])].some((t) => t && contains(text, t));
    (found ? matched : missing).push(k.term);
  });
  return {
    score: Math.round((matched.length / keywords.length) * 100),
    matched,
    missing
  };
}
