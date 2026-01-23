import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiAnalysisResult } from '../types/complaint.js';

// CRITICAL: Verify API key is present at runtime
if (!process.env.GEMINI_API_KEY) {
  console.error('⚠️  GEMINI_API_KEY is missing! Gemini calls will fail.');
}

const GEMINI_TIMEOUT_MS = 60000; // 60 seconds for image analysis API calls

// Initialize Gemini with API key
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing at runtime');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'models/gemini-flash-latest' });
}

async function callWithTimeout<T>(promise: Promise<T>): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini request timed out')), GEMINI_TIMEOUT_MS)
    ),
  ]);
}

/**
 * TEMPORARY: Test Gemini connection on startup
 * Remove after confirming it works.
 */
export async function testGeminiConnection(): Promise<boolean> {
  try {
    const model = getModel();
    const result = await model.generateContent('Return ONLY valid JSON: {"ok": true}');
    const text = result.response.text();
    console.log('✅ Gemini test response:', text);
    return true;
  } catch (err) {
    console.error('❌ Gemini test FAILED:', err);
    return false;
  }
}

export class GeminiService {
  /**
   * Advisory classification for complaint intake.
   * Returns structured data that is then clamped/mapped to our deterministic enums.
   */
  async suggestClassification(
    complaintText: string,
    location: string
  ): Promise<{
    suggested_department: string;
    suggested_severity: string;
    confidence: number;
    reasoning: string;
  }> {
    const model = getModel();

    const prompt = `You are a civic issue triage assistant.
Analyze this complaint and SUGGEST a department and severity. The system will make the final decision.

COMPLAINT LOCATION: ${location}
COMPLAINT TEXT: "${complaintText}"

Return ONLY valid JSON in this exact schema (no markdown, no commentary):
{
  "suggested_department": "string",
  "suggested_severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": 0.0-1.0,
  "reasoning": "short justification in one sentence"
}`;

    const result = await callWithTimeout(model.generateContent(prompt));
    const responseText = result.response.text();

    console.log('Raw Gemini response:', responseText);

    // Extract JSON from response - handle markdown code blocks
    let jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let jsonString = jsonMatch ? jsonMatch[1] : responseText;

    // Fallback to simple brace matching if no code block
    if (!jsonMatch) {
      jsonMatch = responseText.match(/\{[\s\S]*\}/);
      jsonString = jsonMatch ? jsonMatch[0] : responseText;
    }

    if (!jsonString || !jsonString.includes('{')) {
      console.error('Gemini response was not valid JSON:', responseText);
      throw new Error('Invalid Gemini classification response format');
    }

    const parsed = JSON.parse(jsonString);
    console.log('Parsed Gemini response:', parsed);
    return parsed;
  }

  /**
   * Analyze a civic issue image using Gemini Vision API.
   * Returns AI-generated description, category, priority, SLA, and confidence score.
   */
  async analyzeImage(
    imageBase64: string,
    title: string,
    coordinates: { latitude: number; longitude: number }
  ): Promise<GeminiAnalysisResult> {
    try {
      const model = getModel();

      const prompt = `You are an AI system for analyzing civic issue reports submitted by citizens.

CONTEXT:
- Title provided by citizen: "${title}"
- GPS Coordinates: ${coordinates.latitude}, ${coordinates.longitude}

Analyze this image and determine:
1. description: Detailed description of the civic issue shown in the image (2-3 sentences)
2. category: Type of issue. Must be one of: pothole, garbage, streetlight, drainage, water_leak, road_damage, public_property, illegal_dumping, traffic_sign, sidewalk, other
3. severity: LOW | MEDIUM | HIGH | CRITICAL
4. priority: 1-10 score (10 being most urgent)
5. confidence_score: 0.0-1.0 indicating how confident you are this is a REAL civic issue
   - Below 0.2: Likely fake/spam/unrelated image (random photos, screenshots, memes, etc.)
   - 0.2-0.6: Uncertain, may need manual review (image unclear, partially relevant)
   - Above 0.6: Confident this is a real civic issue (clear photo of actual problem)

Return ONLY valid JSON in this exact format (no markdown, no commentary):
{
  "description": "string",
  "category": "string",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "priority": 1-10,
  "confidence_score": 0.0-1.0
}`;

      // Prepare image part for Gemini Vision
      const imagePart = {
        inlineData: {
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''), // Remove data URL prefix if present
          mimeType: 'image/jpeg', // Gemini accepts jpeg, png, webp
        },
      };

      const result = await callWithTimeout(
        model.generateContent([prompt, imagePart])
      );
      const responseText = result.response.text();

      console.log('Raw Gemini Vision response:', responseText);

      // Extract JSON from response - handle markdown code blocks
      let jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      let jsonString = jsonMatch ? jsonMatch[1] : responseText;

      // Fallback to simple brace matching if no code block
      if (!jsonMatch) {
        jsonMatch = responseText.match(/\{[\s\S]*\}/);
        jsonString = jsonMatch ? jsonMatch[0] : responseText;
      }

      if (!jsonString || !jsonString.includes('{')) {
        console.error('Gemini Vision response was not valid JSON:', responseText);
        throw new Error('Invalid Gemini Vision response format');
      }

      const parsed = JSON.parse(jsonString);
      console.log('Parsed Gemini Vision response:', parsed);

      // Validate and normalize severity
      const severityRaw = typeof parsed.severity === 'string'
        ? parsed.severity.toLowerCase()
        : 'medium';
      const allowedSeverities = ['low', 'medium', 'high', 'critical'] as const;
      const severity = allowedSeverities.includes(severityRaw as any)
        ? (severityRaw as (typeof allowedSeverities)[number])
        : 'medium';

      // Validate priority (1-10)
      const priority = Math.min(10, Math.max(1, Math.round(parsed.priority || 5)));

      // Validate confidence score (0.0-1.0)
      const confidenceScore = Math.min(1, Math.max(0, parsed.confidence_score || 0.5));

      // Determine authenticity status based on confidence score
      let authenticityStatus: 'fake' | 'uncertain' | 'real';
      if (confidenceScore < 0.2) {
        authenticityStatus = 'fake';
      } else if (confidenceScore < 0.6) {
        authenticityStatus = 'uncertain';
      } else {
        authenticityStatus = 'real';
      }

      return {
        generatedDescription: parsed.description || 'Unable to generate description',
        category: parsed.category || 'other',
        severity,
        priority,
        confidenceScore,
        authenticityStatus,
      };
    } catch (err) {
      // CRITICAL: Re-throw so caller knows Gemini failed
      console.error('Gemini analyzeImage failed:', err);
      throw err;
    }
  }

  /**
   * Explain why an already-performed escalation is justified.
   * This is advisory only; escalation has already been enforced.
   */
  async explainEscalation(context: {
    department: string;
    severity: string;
    elapsedSeconds: number;
    status: string;
  }): Promise<string> {
    try {
      const model = getModel();

      const prompt = `You are providing an advisory justification for a civic complaint escalation.
The escalation decision is ALREADY MADE by the system. You are only explaining why it is reasonable.

DEPARTMENT: ${context.department}
SEVERITY: ${context.severity}
STATUS: ${context.status}
ELAPSED_TIME_SECONDS: ${Math.round(context.elapsedSeconds)}

Respond with ONE sentence explaining why escalation is justified. No prefixes, no markdown.`;

      const result = await callWithTimeout(model.generateContent(prompt));
      const text = result.response.text();
      return text.trim();
    } catch (err) {
      console.error('Gemini explainEscalation failed:', err);
      return 'Escalation enforced due to SLA breach.';
    }
  }

  /**
   * Generate a one-shot advisory brief for the official dashboard.
   * Summarises top 3 unresolved complaints; read-only, no state changes.
   */
  async officialBrief(input: {
    complaints: Array<{
      id: string;
      description: string;
      department: string;
      severity: string;
      priority: number;
      status: string;
    }>;
  }): Promise<string> {
    try {
      const model = getModel();

      const serialized = input.complaints
        .map(
          (c, idx) =>
            `#${idx + 1} [${c.id}] dept=${c.department}, severity=${c.severity}, priority=${c.priority
            }, status=${c.status}\n"${c.description}"`
        )
        .join('\n\n');

      const prompt = `You are preparing a brief for a municipal official.
You will see up to 3 unresolved complaints. Provide an ADVISORY summary only; you CANNOT change any system state.

COMPLAINTS:
${serialized}

Respond with 2-3 concise sentences under the heading "AI Briefing (Advisory)". No markdown formatting, no bullet points, just plain text.`;

      const result = await callWithTimeout(model.generateContent(prompt));
      const text = result.response.text();
      return text.trim();
    } catch (err) {
      console.error('Gemini officialBrief failed:', err);
      return 'AI Briefing (Advisory): Unable to generate brief at this time.';
    }
  }
}

export const geminiService = new GeminiService();
