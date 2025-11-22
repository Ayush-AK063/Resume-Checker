import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not configured");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateWithTools(
  prompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ response: string; toolCalls?: Array<{ name: string; args: any }> }> {
  try {
    // Only include tools if they are provided and not empty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelConfig: any = {
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,  // Lower temperature for more deterministic tool calling
        topP: 0.8,
        topK: 30,
        maxOutputTokens: 2000,
      },
    };

    // Only add tools if the array is not empty
    if (tools && tools.length > 0) {
      modelConfig.tools = [{ functionDeclarations: tools }];
    }

    const model = genAI.getGenerativeModel(modelConfig);

    // Gemini requires first message to be from 'user', so filter out any leading 'model' messages
    const history = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // If history starts with 'model', remove all leading 'model' messages
    while (history.length > 0 && history[0].role === 'model') {
      history.shift();
    }

    const chat = model.startChat({
      history: history,
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