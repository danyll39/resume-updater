import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { docxToText } from "./lib/docx.js";
import {
  SYSTEM_PROMPT, RESPONSE_SCHEMA, LETTER_PROMPT, TONES,
  normalizeResume, normalizeChanges, normalizeKeywords
} from "./lib/prompt.js";

dotenv.config();

const PORT = process.env.PORT || 3000;
// Flash-Lite has the most generous free-tier daily quota. Change it in .env if you like.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is missing. Add it to the .env file, then restart the server.");
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();
app.use(cors()); // lets the React dev server talk to this server
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", 1); // correct visitor IPs when hosted behind a proxy like Render

// ---------- simple rate limit: protects the free Gemini quota ----------
const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = {
  fix: Number(process.env.MAX_FIXES_PER_15_MIN || 5),
  letter: Number(process.env.MAX_LETTERS_PER_15_MIN || 10)
};
const hits = new Map();
function withinLimit(ip, bucket = "fix") {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMITS[bucket]) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}

// ---------- helpers ----------
function fileKind(file) {
  const ext = path.extname(file.name || "").toLowerCase();
  if (file.type === "application/pdf" || ext === ".pdf") return "pdf";
  if (ext === ".docx" || file.type.includes("wordprocessingml")) return "docx";
  if (file.type.startsWith("text/") || ext === ".txt") return "txt";
  return null;
}

// Read a multipart upload with the web-standard FormData parser built into Node.
async function readForm(req) {
  const body = await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => { size += c.length; if (size <= MAX_BYTES + 200_000) chunks.push(c); });
    req.on("end", () => (size > MAX_BYTES + 200_000
      ? reject(Object.assign(new Error("too big"), { code: "TOO_BIG" }))
      : resolve(Buffer.concat(chunks))));
    req.on("error", reject);
  });
  return new Request("http://local/upload", {
    method: "POST",
    headers: { "content-type": req.headers["content-type"] || "" },
    body
  }).formData();
}

function geminiError(err) {
  const status = err?.status ?? err?.code;
  if (status === 429) return [429, "Gemini's free daily limit has been reached. Try again tomorrow."];
  if (status === 404) return [502, `Gemini model "${MODEL}" wasn't found. Set GEMINI_MODEL in .env to a current model.`];
  if (status === 400 || status === 401 || status === 403) return [502, "Gemini rejected the request. Check that your API key is correct."];
  return [502, "The AI couldn't finish right now. Try again in a minute."];
}

// ---------- routes ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, aiReady: Boolean(process.env.GEMINI_API_KEY), model: MODEL });
});

// Upload a resume (PDF, DOCX, or TXT) or paste text, and get back a fixed,
// structured resume plus a list of every change and why it was made.
app.post("/api/fix", async (req, res) => {
  let form;
  try {
    form = await readForm(req);
  } catch (e) {
    if (e.code === "TOO_BIG") return res.status(413).json({ error: "That file is over 5 MB. Upload a smaller file." });
    return res.status(400).json({ error: "The upload didn't go through. Try again." });
  }

  const file = form.get("resume");
  const pasted = String(form.get("resumeText") || "").trim();
  const jobDesc = String(form.get("jobDesc") || "").slice(0, 15000);
  const parts = [];

  try {
    if (file && typeof file !== "string" && file.size) {
      if (file.size > MAX_BYTES) return res.status(413).json({ error: "That file is over 5 MB. Upload a smaller file." });
      const kind = fileKind(file);
      if (!kind) return res.status(400).json({ error: "Upload a PDF, Word (.docx), or plain text (.txt) file." });
      const buffer = Buffer.from(await file.arrayBuffer());
      if (kind === "pdf") {
        // Gemini reads PDFs directly, layout included.
        parts.push({ inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } });
      } else {
        const text = kind === "docx" ? await docxToText(buffer) : buffer.toString("utf8");
        if (!text.trim()) return res.status(400).json({ error: "We couldn't find any text in that file." });
        parts.push({ text: "RESUME:\n" + text.slice(0, 30000) });
      }
    } else if (pasted) {
      parts.push({ text: "RESUME:\n" + pasted.slice(0, 30000) });
    } else {
      return res.status(400).json({ error: "Upload a resume file or paste your resume text." });
    }
  } catch {
    return res.status(400).json({ error: "We couldn't read that file. Try saving it as a PDF and uploading again." });
  }

  parts.push({
    text: jobDesc.trim()
      ? "JOB DESCRIPTION (use its wording where it is truthful for this person, but keep every fact true):\n" + jobDesc
      : "No job description was provided. Improve the resume for general tech and support roles."
  });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "The server has no Gemini API key. Add GEMINI_API_KEY to the .env file and restart." });
  }
  // Only requests that will reach Gemini count toward the limit.
  if (!withinLimit(req.ip)) {
    return res.status(429).json({ error: "You've fixed several resumes in a row. Wait 15 minutes and try again." });
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.3
      }
    });
    const data = JSON.parse(response.text || "{}");
    if (!data.resume) throw Object.assign(new Error("No resume in response"), { status: 502 });
    res.json({
      resume: normalizeResume(data.resume),
      changes: normalizeChanges(data.changes),
      issues: Array.isArray(data.issues) ? data.issues.filter((i) => typeof i === "string").slice(0, 20) : [],
      job: { company: String(data.job?.company || "").trim(), title: String(data.job?.title || "").trim() },
      jobKeywords: jobDesc.trim() ? normalizeKeywords(data.jobKeywords) : [],
      model: MODEL
    });
  } catch (err) {
    // Log the status only, never the resume.
    console.error("Fix failed:", err?.status ?? "", String(err?.message || "").slice(0, 160));
    const [status, message] = geminiError(err);
    res.status(status).json({ error: message });
  }
});

// Write a cover letter from the (fixed) resume and a job description.
app.post("/api/cover-letter", async (req, res) => {
  const { resume, jobDesc = "", company = "", jobTitle = "", hiringManager = "", tone = "professional" } = req.body || {};
  if (!resume || typeof resume !== "object" || !resume.name) {
    return res.status(400).json({ error: "Fix a resume first, then write the cover letter." });
  }
  if (!String(jobDesc).trim() && !String(jobTitle).trim()) {
    return res.status(400).json({ error: "Add a job description or at least a job title for the cover letter." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "The server has no Gemini API key. Add GEMINI_API_KEY to the .env file and restart." });
  }
  if (!withinLimit(req.ip, "letter")) {
    return res.status(429).json({ error: "You've written several letters in a row. Wait 15 minutes and try again." });
  }

  const clean = normalizeResume(resume);
  const details = [
    `Company: ${String(company).trim() || "not given"}`,
    `Job title: ${String(jobTitle).trim() || "not given"}`,
    `Address the letter to: ${String(hiringManager).trim() || "Hiring Manager"}`,
    `Tone: ${TONES[tone] || TONES.professional}`
  ].join("\n");

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: "user",
        parts: [
          { text: details },
          { text: "RESUME (JSON):\n" + JSON.stringify(clean).slice(0, 30000) },
          { text: "JOB DESCRIPTION:\n" + (String(jobDesc).slice(0, 15000) || "Not provided. Write a general letter for the job title above.") }
        ]
      }],
      config: { systemInstruction: LETTER_PROMPT, temperature: 0.6 }
    });
    const letter = String(response.text || "").replace(/\*\*/g, "").trim();
    if (!letter) throw Object.assign(new Error("Empty letter"), { status: 502 });
    res.json({ letter, model: MODEL });
  } catch (err) {
    console.error("Letter failed:", err?.status ?? "", String(err?.message || "").slice(0, 160));
    const [status, message] = geminiError(err);
    res.status(status).json({ error: message });
  }
});

// Original endpoint from v1: paste text + job description, get Markdown back.
app.post("/resume-updater", async (req, res) => {
  const { resumeText, jobDesc } = req.body || {};
  if (!resumeText || !jobDesc) return res.status(400).json({ error: "Send resumeText and jobDesc." });
  if (!withinLimit(req.ip)) return res.status(429).json({ error: "Too many requests. Wait 15 minutes and try again." });

  const prompt = `Rewrite this resume to match this job description. Keep every fact true. Return Markdown.\n\nResume:\n${resumeText}\n\nJob:\n${jobDesc}`;
  try {
    const response = await ai.models.generateContent({ model: MODEL, contents: prompt });
    res.json({ updatedResume: response.text });
  } catch (err) {
    console.error("Update failed:", err?.status ?? "", String(err?.message || "").slice(0, 160));
    const [status, message] = geminiError(err);
    res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (model: ${MODEL})`);
});
