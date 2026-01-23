import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiAnalysisResult, Complaint } from '../types/complaint.js';

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
  "confidence_score": 0.0-1.0,
  "is_emergency": true|false,
  "emergency_type": "string or null",
  "sentiment_score": -1.0 to 1.0
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
        isEmergency: parsed.is_emergency || false,
        emergencyType: parsed.emergency_type || null,
        sentimentScore: parsed.sentiment_score ?? 0,
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

  /**
   * 🆘 EMERGENCY DETECTION
   * Analyze text for life-threatening or urgent safety issues
   */
  async detectEmergency(text: string): Promise<{
    isEmergency: boolean;
    emergencyType: string | null;
    urgencyLevel: 'IMMEDIATE' | 'URGENT' | 'STANDARD';
    reasoning: string;
  }> {
    try {
      const model = getModel();
      const prompt = `You are an emergency detection system for civic complaints.
Analyze this text for life-threatening or urgent safety issues.

TEXT: "${text}"

Emergency types include:
- Gas leak, fire hazard, electrical danger
- Collapsed structure, open manholes, broken bridges
- Flood, water contamination, sewage overflow
- Exposed wires, fallen power lines
- Any immediate threat to human life

Return ONLY valid JSON:
{
  "isEmergency": true|false,
  "emergencyType": "string or null",
  "urgencyLevel": "IMMEDIATE|URGENT|STANDARD",
  "reasoning": "one sentence explanation"
}`;

      const result = await callWithTimeout(model.generateContent(prompt));
      const responseText = result.response.text();
      
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      
      return {
        isEmergency: parsed.isEmergency || false,
        emergencyType: parsed.emergencyType || null,
        urgencyLevel: parsed.urgencyLevel || 'STANDARD',
        reasoning: parsed.reasoning || 'No emergency detected',
      };
    } catch (err) {
      console.error('Emergency detection failed:', err);
      return { isEmergency: false, emergencyType: null, urgencyLevel: 'STANDARD', reasoning: 'Detection failed' };
    }
  }

  /**
   * 🎤 VOICE COMPLAINT TRANSCRIPTION
   * Transcribe audio and extract complaint details using Gemini
   */
  async analyzeVoiceComplaint(audioBase64: string, mimeType: string = 'audio/webm'): Promise<{
    transcription: string;
    category: string;
    severity: string;
    urgency: string;
    isEmergency: boolean;
    sentimentScore: number;
  }> {
    try {
      const model = getModel();
      
      const audioPart = {
        inlineData: {
          data: audioBase64.replace(/^data:audio\/\w+;base64,/, ''),
          mimeType,
        },
      };

      const prompt = `You are a civic complaint assistant. Listen to this audio recording and:
1. Transcribe what the citizen is saying
2. Identify the type of civic issue
3. Assess the severity and urgency
4. Detect if this is an emergency
5. Gauge the citizen's emotional state

Return ONLY valid JSON:
{
  "transcription": "full text of what was said",
  "category": "pothole|garbage|streetlight|drainage|water_leak|road_damage|public_property|other",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "urgency": "IMMEDIATE|URGENT|STANDARD",
  "isEmergency": true|false,
  "sentimentScore": -1.0 to 1.0 (negative=frustrated, positive=calm)
}`;

      const result = await callWithTimeout(model.generateContent([prompt, audioPart]));
      const responseText = result.response.text();
      
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      
      return {
        transcription: parsed.transcription || '',
        category: parsed.category || 'other',
        severity: parsed.severity || 'MEDIUM',
        urgency: parsed.urgency || 'STANDARD',
        isEmergency: parsed.isEmergency || false,
        sentimentScore: parsed.sentimentScore ?? 0,
      };
    } catch (err) {
      console.error('Voice analysis failed:', err);
      throw new Error('Failed to analyze voice complaint');
    }
  }

  /**
   * 🔍 DUPLICATE DETECTION
   * Check if a new complaint is similar to existing ones
   */
  async detectDuplicate(
    newComplaint: { title: string; description: string; location: { lat: number; lng: number } },
    existingComplaints: Array<{ id: string; title: string; description: string; location?: { latitude: number; longitude: number } }>
  ): Promise<{
    isDuplicate: boolean;
    matchedComplaintId: string | null;
    similarity: number;
    reasoning: string;
  }> {
    try {
      if (existingComplaints.length === 0) {
        return { isDuplicate: false, matchedComplaintId: null, similarity: 0, reasoning: 'No existing complaints to compare' };
      }

      const model = getModel();
      
      const existingSummary = existingComplaints.slice(0, 10).map(c => 
        `ID: ${c.id}, Title: "${c.title}", Description: "${c.description.slice(0, 100)}"`
      ).join('\n');

      const prompt = `You are a duplicate detection system for civic complaints.

NEW COMPLAINT:
Title: "${newComplaint.title}"
Description: "${newComplaint.description}"
Location: ${newComplaint.location.lat}, ${newComplaint.location.lng}

EXISTING COMPLAINTS:
${existingSummary}

Determine if the new complaint is a duplicate or very similar to any existing one.
Consider: same issue type, similar location (within ~100m), similar description.

Return ONLY valid JSON:
{
  "isDuplicate": true|false,
  "matchedComplaintId": "id or null",
  "similarity": 0.0-1.0,
  "reasoning": "one sentence explanation"
}`;

      const result = await callWithTimeout(model.generateContent(prompt));
      const responseText = result.response.text();
      
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      
      return {
        isDuplicate: parsed.isDuplicate || false,
        matchedComplaintId: parsed.matchedComplaintId || null,
        similarity: parsed.similarity || 0,
        reasoning: parsed.reasoning || 'No match found',
      };
    } catch (err) {
      console.error('Duplicate detection failed:', err);
      return { isDuplicate: false, matchedComplaintId: null, similarity: 0, reasoning: 'Detection failed' };
    }
  }

  /**
   * 🖼️ BEFORE/AFTER RESOLUTION VERIFICATION
   * Compare before and after images to verify if issue was resolved
   */
  async verifyResolution(
    beforeImageBase64: string,
    afterImageBase64: string,
    complaintCategory: string
  ): Promise<{
    isResolved: boolean;
    confidenceScore: number;
    reasoning: string;
    remainingIssues: string[];
  }> {
    try {
      const model = getModel();
      
      const beforePart = {
        inlineData: {
          data: beforeImageBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/jpeg',
        },
      };
      
      const afterPart = {
        inlineData: {
          data: afterImageBase64.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/jpeg',
        },
      };

      const prompt = `You are a resolution verification system for civic complaints.

COMPLAINT CATEGORY: ${complaintCategory}

You will see two images:
1. BEFORE: The original civic issue
2. AFTER: The current state after repair/resolution attempt

Analyze both images and determine:
1. Has the issue been fully resolved?
2. What is your confidence in this assessment?
3. Are there any remaining issues?

Return ONLY valid JSON:
{
  "isResolved": true|false,
  "confidenceScore": 0.0-1.0,
  "reasoning": "detailed explanation of what you observed",
  "remainingIssues": ["list of any remaining problems"]
}`;

      const result = await callWithTimeout(model.generateContent([prompt, beforePart, afterPart]));
      const responseText = result.response.text();
      
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      
      return {
        isResolved: parsed.isResolved || false,
        confidenceScore: parsed.confidenceScore || 0.5,
        reasoning: parsed.reasoning || 'Unable to determine',
        remainingIssues: parsed.remainingIssues || [],
      };
    } catch (err) {
      console.error('Resolution verification failed:', err);
      throw new Error('Failed to verify resolution');
    }
  }

  /**
   * 💬 AI CHATBOT FOR CITIZENS
   * Conversational assistant for complaint status and help
   */
  async chatWithCitizen(
    conversation: Array<{ role: 'user' | 'model'; content: string }>,
    citizenContext?: { name: string; activeComplaints?: number }
  ): Promise<{
    response: string;
    suggestedActions: string[];
  }> {
    try {
      const model = getModel();
      
      const contextInfo = citizenContext 
        ? `Citizen Name: ${citizenContext.name}, Active Complaints: ${citizenContext.activeComplaints || 0}`
        : 'New citizen';

      const systemPrompt = `You are CivicFix AI Assistant, a helpful chatbot for citizens reporting civic issues.
You can help with:
- Explaining complaint status
- Guiding how to report issues
- Answering FAQs about the system
- Providing updates on resolution timelines

Context: ${contextInfo}

Be concise, helpful, and empathetic. If you don't know something specific about a complaint, say so.
Always suggest relevant actions the citizen can take.`;

      const chatHistory = conversation.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }));

      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'I understand. I am CivicFix AI Assistant, ready to help citizens with their civic complaints.' }] },
          ...chatHistory.slice(0, -1),
        ],
      });

      const lastMessage = conversation[conversation.length - 1]?.content || 'Hello';
      const result = await callWithTimeout(chat.sendMessage(lastMessage));
      const responseText = result.response.text();

      // Extract suggested actions if any
      const suggestedActions: string[] = [];
      if (responseText.toLowerCase().includes('report')) suggestedActions.push('Report New Issue');
      if (responseText.toLowerCase().includes('status')) suggestedActions.push('Check Complaint Status');
      if (responseText.toLowerCase().includes('escalate')) suggestedActions.push('Request Escalation');

      return {
        response: responseText.trim(),
        suggestedActions,
      };
    } catch (err) {
      console.error('Chatbot failed:', err);
      return {
        response: 'I apologize, but I\'m having trouble responding right now. Please try again or contact support.',
        suggestedActions: ['Contact Support', 'Try Again'],
      };
    }
  }

  /**
   * 📊 DEPARTMENT PERFORMANCE ANALYTICS
   * Generate AI-powered performance report for a department
   */
  async generateDepartmentReport(
    departmentName: string,
    metrics: {
      totalComplaints: number;
      resolvedCount: number;
      avgResolutionHours: number;
      escalatedCount: number;
      slaBreachCount: number;
    }
  ): Promise<{
    summary: string;
    strengths: string[];
    areasForImprovement: string[];
    recommendations: string[];
    performanceScore: number;
  }> {
    try {
      const model = getModel();
      
      const prompt = `You are an analytics AI for municipal performance evaluation.

DEPARTMENT: ${departmentName}
METRICS:
- Total Complaints: ${metrics.totalComplaints}
- Resolved: ${metrics.resolvedCount} (${((metrics.resolvedCount / metrics.totalComplaints) * 100).toFixed(1)}%)
- Average Resolution Time: ${metrics.avgResolutionHours.toFixed(1)} hours
- Escalated: ${metrics.escalatedCount}
- SLA Breaches: ${metrics.slaBreachCount}

Generate a performance report with actionable insights.

Return ONLY valid JSON:
{
  "summary": "2-3 sentence executive summary",
  "strengths": ["list of 2-3 strengths"],
  "areasForImprovement": ["list of 2-3 areas"],
  "recommendations": ["list of 2-3 specific actions"],
  "performanceScore": 0-100
}`;

      const result = await callWithTimeout(model.generateContent(prompt));
      const responseText = result.response.text();
      
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      
      return {
        summary: parsed.summary || 'Unable to generate summary',
        strengths: parsed.strengths || [],
        areasForImprovement: parsed.areasForImprovement || [],
        recommendations: parsed.recommendations || [],
        performanceScore: parsed.performanceScore || 50,
      };
    } catch (err) {
      console.error('Department report generation failed:', err);
      return {
        summary: 'Unable to generate report at this time.',
        strengths: [],
        areasForImprovement: [],
        recommendations: [],
        performanceScore: 0,
      };
    }
  }

  /**
   * 🔮 PREDICTIVE ISSUE FORECASTING
   * Predict upcoming issues based on historical patterns
   */
  async predictUpcomingIssues(
    historicalData: Array<{ category: string; location: string; createdAt: string }>
  ): Promise<{
    predictions: Array<{
      area: string;
      issueType: string;
      probability: number;
      suggestedPreventiveAction: string;
      estimatedTimeframe: string;
    }>;
  }> {
    try {
      const model = getModel();
      
      const dataSummary = historicalData.slice(0, 50).map(d => 
        `${d.category} at ${d.location} on ${d.createdAt}`
      ).join('\n');

      const prompt = `You are a predictive analytics AI for municipal planning.

HISTORICAL COMPLAINT DATA:
${dataSummary}

Based on patterns in this data, predict 2-3 likely upcoming issues.
Consider seasonal patterns, recurring locations, and issue types.

Return ONLY valid JSON:
{
  "predictions": [
    {
      "area": "location name",
      "issueType": "category",
      "probability": 0.0-1.0,
      "suggestedPreventiveAction": "specific action",
      "estimatedTimeframe": "e.g., next 2 weeks"
    }
  ]
}`;

      const result = await callWithTimeout(model.generateContent(prompt));
      const responseText = result.response.text();
      
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      
      return {
        predictions: parsed.predictions || [],
      };
    } catch (err) {
      console.error('Prediction failed:', err);
      return { predictions: [] };
    }
  }
}

export const geminiService = new GeminiService();
