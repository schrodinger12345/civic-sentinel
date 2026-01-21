import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

try {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const prompt = `You are a civic issue triage assistant.
Analyze this complaint and SUGGEST a department and severity. The system will make the final decision.

COMPLAINT LOCATION: Downtown
COMPLAINT TEXT: "Pothole on Main Street causing bike accidents"

Return ONLY valid JSON in this exact schema (no markdown, no commentary):
{
  "suggested_department": "string",
  "suggested_severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": 0.0-1.0,
  "reasoning": "short justification in one sentence"
}`;

  console.log('Sending request to Gemini...');
  const res = await model.generateContent(prompt);
  const text = res.response.text();
  console.log('Raw response:');
  console.log(text);
} catch (err) {
  console.error('ERROR:', err.message);
}
