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

export async function generateWithGemini(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2000,
      },
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text.trim();
  } catch (error) {
    console.error("Gemini API error:", error);
    
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

export async function generateWithTools(
  prompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ response: string; toolCalls?: Array<{ name: string; args: any }> }> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,  // Lower temperature for more deterministic tool calling
        topP: 0.8,
        topK: 30,
        maxOutputTokens: 2000,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ functionDeclarations: tools as any }],
    });

    const chat = model.startChat({
      history: conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
    });

    console.log("Sending message to Gemini with tools...");
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    console.log("Received response from Gemini");

    // Check if the model wants to call a function
    try {
      const functionCalls = response.functionCalls();
      
      if (functionCalls && functionCalls.length > 0) {
        console.log("✅ Function calls detected:", functionCalls.length);
        console.log("Tool called:", functionCalls[0].name, "with args:", functionCalls[0].args);
        
        // When function call is present, IGNORE any text response from LLM
        // Return ONLY the tool calls, with empty response text
        return {
          response: '',  // Always empty when tool is called
          toolCalls: functionCalls.map(call => ({
            name: call.name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            args: call.args as any,
          })),
        };
      }
    } catch (fnError) {
      console.log("⚠️ No function calls or error checking function calls:", fnError);
      // Continue to try getting text response
    }

    // Try to get text response
    try {
      const textResponse = response.text();
      console.log("Got text response from Gemini");
      return {
        response: textResponse.trim(),
      };
    } catch (textError) {
      console.error("Error getting text from response:", textError);
      throw new Error("Failed to extract response from Gemini");
    }
  } catch (error) {
    console.error("Gemini tool calling error:", error);
    
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = error.message as string;
      
      if (errorMessage.includes('API_KEY_INVALID')) {
        throw new Error("Invalid Gemini API key. Please check your GEMINI_API_KEY configuration.");
      }
      if (errorMessage.includes('QUOTA_EXCEEDED')) {
        throw new Error("Gemini API quota exceeded. Please try again later.");
      }
    }
    
    throw error;
  }
}