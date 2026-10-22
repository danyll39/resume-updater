import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function updateResume(oldResume, jobDescription) {
  const prompt = `
    You are a professional career coach and expert resume writer. 
    I will provide an old resume and a job description. 
    Your task:
    1. Analyze the job description for key skills and keywords.
    2. Rewrite the resume bullet points to highlight relevant achievements using the STAR method.
    3. Ensure the tone is professional and ATS-friendly.
    
    OLD RESUME:
    ${oldResume}
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    Updated Resume (Return in Markdown format):
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}