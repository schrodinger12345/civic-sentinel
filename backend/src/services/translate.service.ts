import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with API key
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing at runtime');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

export class TranslateService {
  /**
   * Detects if text is in Hindi or Marathi and translates to English.
   * Preserves original text if translation fails or is not needed.
   */
  async translateToEnglish(text: string): Promise<{
    originalText: string;
    translatedText: string;
    detectedLanguage: 'hindi' | 'marathi' | 'english' | 'other';
    wasTranslated: boolean;
  }> {
    if (!text || text.trim().length === 0) {
      return {
        originalText: text,
        translatedText: text,
        detectedLanguage: 'other',
        wasTranslated: false,
      };
    }

    try {
      const model = getModel();
      const prompt = `You are a translation assistant for a civic complaint system.
The user might write in English, Hindi, or Marathi.
If the text is in Hindi or Marathi, translate it to clear, professional English.
If the text is already in English, return it exactly as is.

INPUT TEXT: "${text}"

Return ONLY valid JSON in this format:
{
  "detectedLanguage": "hindi" | "marathi" | "english" | "other",
  "translatedText": "string",
  "wasTranslated": boolean
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Extract JSON from response
      let jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      let jsonString = jsonMatch ? jsonMatch[1] : responseText;
      
      if (!jsonMatch) {
         jsonMatch = responseText.match(/\{[\s\S]*\}/);
         jsonString = jsonMatch ? jsonMatch[0] : responseText;
      }

      if (!jsonString || !jsonString.includes('{')) {
        console.warn('Translation response was not valid JSON, using fallback');
        return {
          originalText: text,
          translatedText: text,
          detectedLanguage: 'other',
          wasTranslated: false,
        };
      }

      const parsed = JSON.parse(jsonString);
      
      return {
        originalText: text,
        translatedText: parsed.translatedText || text,
        detectedLanguage: parsed.detectedLanguage || 'other',
        wasTranslated: parsed.wasTranslated || false,
      };

    } catch (error) {
      console.error('Translation failed:', error);
      // Fallback: return original
      return {
        originalText: text,
        translatedText: text,
        detectedLanguage: 'other',
        wasTranslated: false,
      };
    }
  }
}

export const translateService = new TranslateService();
