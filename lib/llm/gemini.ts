import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not configured");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function evaluateResume(resumeText: string, prompt: string): Promise<string> {
  try {
    // Using gemini-2.0-flash which is available
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1000,
      },
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up the response to extract JSON
    text = text.trim();
    
    // Remove markdown code block formatting if present
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Try to find JSON object if response contains extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
    
    // Validate that it's valid JSON before returning
    try {
      JSON.parse(text);
    } catch {
      console.error('Invalid JSON from Gemini:', text);
      throw new Error(`Gemini returned invalid JSON format: ${text.substring(0, 200)}...`);
    }
    
    return text;
  } catch (error) {
    console.error("Gemini API error:", error);
    
    // Provide more specific error messages
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = error.message as string;
      
      if (errorMessage.includes('API_KEY_INVALID')) {
        throw new Error("Invalid Gemini API key. Please check your GEMINI_API_KEY configuration.");
      }
      if (errorMessage.includes('QUOTA_EXCEEDED')) {
        throw new Error("Gemini API quota exceeded. Please try again later.");
      }
      if (errorMessage.includes('models/') && errorMessage.includes('not found')) {
        throw new Error("Gemini model not available. Please try again later.");
      }
    }
    
    throw error;
  }
}