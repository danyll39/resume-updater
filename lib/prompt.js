// What we ask Gemini to do, and the exact JSON shapes it must return.

// ---------- Fixing a resume ----------
export const SYSTEM_PROMPT = `You are an experienced resume editor for tech and customer-support roles.
Improve the resume you are given. Rules:
- Keep every fact true. Never invent employers, job titles, dates, degrees, numbers, tools, or achievements.
- Keep existing numbers exactly as written. You may suggest adding a metric only in "issues", never in the resume itself.
- Fix spelling, grammar, punctuation, and inconsistent formatting (dates, capitalization).
- Start each bullet with a strong action verb: present tense for a current role, past tense for past roles. Remove "Responsible for" and filler.
- Keep bullets to one or two lines, written without "I".
- Group skills sensibly and remove duplicates.
- If a job description is provided, prefer its wording where it is truthful for this person, and say so in "changes".

How to report changes (the person accepts or rejects each one):
- Each change covers exactly ONE whole field: the summary, one bullet, one project description, one skill group's list, or one title line.
- "before" is the complete original text of that field. "after" is the complete new text, copied exactly as it appears in "resume".
- For a skill group, write the items as one comma-separated line in both "before" and "after".
- Leave "before" empty only if the field is brand new.
- Put anything you could not fix (missing dates, no metrics, gaps) in "issues" as short advice to the person.

If a job description is provided:
- In "job", give the company name and job title from the posting (empty strings if not stated).
- In "jobKeywords", list up to 25 skills, tools, and qualifications from the posting that a recruiter or applicant tracking system would scan for. Keep each "term" to 1-3 words, most important first, and put other common spellings in "aliases" (for example "JS" for "JavaScript").
If no job description is provided, return an empty "jobKeywords" list and empty "job" fields.`;

const STRING = { type: "STRING" };
const STRINGS = { type: "ARRAY", items: STRING };

export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    resume: {
      type: "OBJECT",
      properties: {
        name: STRING, title: STRING, location: STRING, phone: STRING, email: STRING, links: STRINGS, summary: STRING,
        skills: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { group: STRING, items: STRINGS }, required: ["group", "items"] }
        },
        experience: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { company: STRING, role: STRING, location: STRING, dates: STRING, bullets: STRINGS },
            required: ["company", "role", "bullets"]
          }
        },
        projects: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { name: STRING, tech: STRING, description: STRING }, required: ["name", "description"] }
        },
        education: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { school: STRING, credential: STRING, dates: STRING, detail: STRING }, required: ["school"] }
        }
      },
      required: ["name", "summary", "skills", "experience"]
    },
    changes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { section: STRING, before: STRING, after: STRING, reason: STRING },
        required: ["section", "before", "after", "reason"]
      }
    },
    issues: STRINGS,
    job: { type: "OBJECT", properties: { company: STRING, title: STRING } },
    jobKeywords: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { term: STRING, aliases: STRINGS }, required: ["term"] }
    }
  },
  required: ["resume", "changes", "issues", "jobKeywords"]
};

const s = (v) => (typeof v === "string" ? v.trim() : "");
const arr = (v) => (Array.isArray(v) ? v : []);

// Fill in anything Gemini left out so the app can always render the result.
export function normalizeResume(r = {}) {
  return {
    name: s(r.name), title: s(r.title), location: s(r.location), phone: s(r.phone), email: s(r.email),
    links: arr(r.links).map(s).filter(Boolean),
    summary: s(r.summary),
    skills: arr(r.skills)
      .map((g) => ({ group: s(g?.group) || "Skills", items: arr(g?.items).map(s).filter(Boolean) }))
      .filter((g) => g.items.length),
    experience: arr(r.experience).map((x) => ({
      company: s(x?.company), role: s(x?.role), location: s(x?.location), dates: s(x?.dates),
      bullets: arr(x?.bullets).map(s).filter(Boolean)
    })),
    projects: arr(r.projects).map((p) => ({ name: s(p?.name), tech: s(p?.tech), description: s(p?.description) })),
    education: arr(r.education).map((e) => ({ school: s(e?.school), credential: s(e?.credential), dates: s(e?.dates), detail: s(e?.detail) }))
  };
}

export function normalizeChanges(list) {
  return arr(list)
    .map((c) => ({ section: s(c?.section) || "Resume", before: s(c?.before), after: s(c?.after), reason: s(c?.reason) }))
    .filter((c) => c.after && c.after !== c.before)
    .slice(0, 60);
}

export function normalizeKeywords(list) {
  const seen = new Set();
  return arr(list)
    .map((k) => ({ term: s(k?.term), aliases: arr(k?.aliases).map(s).filter(Boolean).slice(0, 5) }))
    .filter((k) => k.term && !seen.has(k.term.toLowerCase()) && seen.add(k.term.toLowerCase()))
    .slice(0, 25);
}

// ---------- Writing a cover letter ----------
export const TONES = {
  professional: "professional and polished",
  warm: "warm and personable, while staying professional",
  confident: "confident and direct, without sounding arrogant"
};

export const LETTER_PROMPT = `You write cover letters for job seekers in tech and customer-support roles.
Rules:
- Use only facts from the resume provided. Never invent employers, numbers, tools, degrees, or achievements.
- Connect the person's real experience to what the job description asks for, using its wording where it is truthful.
- 250 to 350 words, 3 or 4 short paragraphs, plain text with a blank line between paragraphs. No markdown.
- Start with the greeting line ("Dear ...,") and end with "Sincerely," followed by the person's name on the next line.
- Do not include a date, addresses, or a subject line.
- Avoid cliches like "I am writing to express my interest" and "team player".`;
