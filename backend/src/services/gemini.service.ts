import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiAnalysisResult } from '../types/complaint.js';

// CRITICAL: Verify API key is present at runtime
if (!process.env.GEMINI_API_KEY) {
  console.error('⚠️  GEMINI_API_KEY is missing! Gemini calls will fail.');
}

const GEMINI_TIMEOUT_MS = 10000; // 10 seconds for API calls

// Initialize Gemini with API key
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing at runtime');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
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
   * Backwards-compatible wrapper returning GeminiAnalysisResult used by the rest of the codebase.
   * Applies clamping + sensible defaults if Gemini output is partial.
   */
  async analyzeComplaint(
    complaintText: string,
    location: string
  ): Promise<GeminiAnalysisResult> {
    try {
      const suggestion = await this.suggestClassification(complaintText, location);

      const severityRaw =
        typeof suggestion.suggested_severity === 'string'
          ? suggestion.suggested_severity.toLowerCase()
          : 'medium';
      const allowedSeverities = ['low', 'medium', 'high', 'critical'] as const;
      const severity = allowedSeverities.includes(severityRaw as any)
        ? (severityRaw as (typeof allowedSeverities)[number])
        : 'medium';

      const department =
        typeof suggestion.suggested_department === 'string' && suggestion.suggested_department.trim()
          ? suggestion.suggested_department.trim()
          : 'Public Works';

      // Simple priority heuristic derived from severity; deterministic.
      const priorityMap: Record<string, number> = {
        low: 3,
        medium: 5,
        high: 8,
        critical: 10,
      };

      const priority = priorityMap[severity];

      // SLA hours by severity – production-safe default; demo overrides via DEMO_SLA_SECONDS.
      const slaBySeverity: Record<string, number> = {
        low: 168, // 1 week
        medium: 48,
        high: 24,
        critical: 6,
      };

      const suggestedSLA = slaBySeverity[severity] ?? 48;

      const reasoning =
        typeof suggestion.reasoning === 'string' && suggestion.reasoning.trim()
          ? suggestion.reasoning.trim()
          : 'AI classification completed';

      return {
        issueType: 'other',
        severity,
        department,
        priority,
        reasoning,
        suggestedSLA,
        publicImpact: 'Impact estimated from AI advisory classification',
      };
    } catch (err) {
      // CRITICAL: Re-throw so caller knows Gemini failed and can set usedAI = false
      // This ensures epistemic honesty - fallback is never labeled as Gemini
      console.error('Gemini analyzeComplaint failed:', err);
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
