# Resume Updater

Upload a resume and Google Gemini fixes it: grammar, stronger bullet points, and wording matched to a job description, without inventing anything. You see every change and the reason for it, then copy or print the result.

**Built with:** React (Vite), Node.js, Express, and the Google Gemini API (`@google/genai`)

## Features

- Upload a **PDF, Word (.docx), or .txt** resume, or paste the text
- **Fix with AI**: Gemini fixes grammar, strengthens bullet points, and matches the wording to a job description, without inventing facts
- **Review every change**: see the original and new wording with the reason, then keep it or switch back, one change at a time or all at once
- **Edit directly**: change any section of the fixed resume in a form, and the preview updates as you type
- **Job match score**: Gemini picks out the skills and keywords the job asks for, and the app checks them against your resume in the browser, so the score updates live as you edit
- **Cover letter writer**: Gemini drafts a letter from your fixed resume and the job description in a professional, warm, or confident tone, and you can edit it on the page
- **Download as Word (.docx)**, copy as text, or **print / save as PDF** for both the resume and the cover letter
- **Saved versions**: keep a tailored resume and letter for each job you apply to (stored in your browser)
- A required **sensitive-information warning** before anything is sent to Gemini

## Run it locally

1. Get a free Gemini API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Create a `.env` file in the project root (see `.env.example`):
   ```
   GEMINI_API_KEY=your-key-here
   ```
3. Install packages and start both the server and the React app:
   ```bash
   npm install
   npm install --prefix frontend
   npm run dev
   ```
4. Open the address Vite prints, usually http://localhost:5173.

The Express server runs on port 3000. In development, Vite forwards `/api` requests to it, so the API key never reaches the browser.

## How it works

```
index.js                   Express server
  POST /api/fix              Upload or paste a resume (+ optional job description); returns the
                             fixed resume, each change, tips, the job's keywords, company and title
  POST /api/cover-letter     Resume JSON + job details + tone; returns a cover letter
  POST /resume-updater       Original v1 endpoint: text in, Markdown out
lib/prompt.js              Gemini instructions and the JSON schema replies must follow
lib/docx.js                Reads text from uploaded .docx files with Node's built-in zlib

frontend/src/App.jsx       App state and layout
frontend/src/components/   UploadBox, ResumePreview, ResumeEditor, ChangeList,
                           MatchPanel, CoverLetter, VersionsPanel
frontend/src/lib/match.js    Live keyword match score
frontend/src/lib/changes.js  Keep or undo a single change
frontend/src/lib/docx.js     Builds Word files in the browser (no extra packages)
frontend/src/lib/storage.js  Saved versions in localStorage
```

PDFs go to Gemini directly, since it reads them natively. Word and text files are converted to text first. Gemini returns structured JSON, which keeps the output consistent and easy to display.

## Limits and privacy

- The Gemini free tier has a daily request limit. The server also allows 5 fixes per visitor every 15 minutes (`MAX_FIXES_PER_15_MIN`).
- On the free tier, Google may use what's sent to improve its products, and people may review it. Before uploading, the app asks users to remove sensitive details (ID numbers, date of birth, full address, financial or health details, references) and to check a box confirming they understand.
- The server never logs resume contents, and `.env` is in `.gitignore`.
- Saved versions stay in the browser where they were saved. Nothing is stored on the server.

## Settings (`.env`)

| Variable | Default | What it does |
| --- | --- | --- |
| `GEMINI_API_KEY` | none | Required |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Any current Gemini model |
| `PORT` | `3000` | Server port |
| `MAX_FIXES_PER_15_MIN` | `5` | Fixes allowed per visitor every 15 minutes |
| `MAX_LETTERS_PER_15_MIN` | `10` | Cover letters allowed per visitor every 15 minutes |
