import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';

dotenv.config();

console.log("--- SERVER STARTING ---");
console.log("Your API Key starts with: ", process.env.GEMINI_API_KEY?.substring(0, 5));

const app = express();
app.use(cors()); // This allows your React app to talk to this server
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY 
});



app.post('/resume-updater', async (req, res) => {
  const { resumeText, jobDesc } = req.body;
  
  const prompt = `Rewrite this resume to match this job description. Resume: ${resumeText} Job: ${jobDesc}`;

  try {
    // New SDK method call
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: prompt,
    });

    // The response structure is also simpler now
    console.log("Success! Gemini sent back data.");
    res.json({ updatedResume: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));