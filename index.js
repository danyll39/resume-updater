import * as dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { createApp } from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 3000;
// Flash-Lite has the most generous free-tier daily quota. Change it in .env if you like.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is missing. Add it to the .env file, then restart the server.");
}

// The built React app (created by `npm run build`). If it isn't there, only the API runs.
const staticDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "frontend", "dist");

const app = createApp({
  staticDir,
  ai: new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
  model: MODEL,
  aiReady: Boolean(process.env.GEMINI_API_KEY),
  limits: {
    fix: Number(process.env.MAX_FIXES_PER_15_MIN || 5),
    letter: Number(process.env.MAX_LETTERS_PER_15_MIN || 10)
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (model: ${MODEL})`);
});
