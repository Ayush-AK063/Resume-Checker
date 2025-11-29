import { GoogleGenerativeAI, FunctionDeclaration } from "@google/generative-ai";
import { withGeneration, setTokenUsage } from "@/lib/tracing";
import { Span } from "@opentelemetry/api";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not configured");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateWithTools(
  prompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  tools: FunctionDeclaration[]
): Promise<{ 
  response: string; 
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }> 
}> {
  return withGeneration(
    "Gemini Generation",
    async (span: Span) => {
      try {
        // Configure the model
        const modelConfig = {
          model: "gemini-2.0-flash",
          generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            topK: 30,
            maxOutputTokens: 2000,
          },
        };

        // Add tool name to span if tools are provided
        if (tools.length > 0) {
          span.setAttribute("tools.count", tools.length);
          span.setAttribute("tools.names", tools.map(t => t.name).join(", "));
        }

        const model = tools.length > 0 
          ? genAI.getGenerativeModel({
              ...modelConfig,
              tools: [{ functionDeclarations: tools }],
            })
          : genAI.getGenerativeModel(modelConfig);

        // Prepare conversation history
        const history = conversationHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        }));

        // Remove leading 'model' messages to avoid API errors
        while (history.length > 0 && history[0].role === 'model') {
          history.shift();
        }

        span.setAttribute("conversation.history_length", history.length);

        // Start chat and send message
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(prompt);
        const response = await result.response;

        // Track token usage
        const usage = response.usageMetadata;
        if (usage) {
          setTokenUsage(span, {
            promptTokens: usage.promptTokenCount || 0,
            completionTokens: usage.candidatesTokenCount || 0,
            totalTokens: usage.totalTokenCount || 0,
          });
        }

        // Check for function calls
        try {
          const functionCalls = response.functionCalls();
          if (functionCalls && functionCalls.length > 0) {
            const toolCalls = functionCalls.map(call => ({
              name: call.name,
              args: call.args as Record<string, unknown>,
            }));

            span.setAttribute("response.type", "tool_call");
            span.setAttribute("tool_calls.count", toolCalls.length);
            span.setAttribute("tool_calls.names", toolCalls.map(t => t.name).join(", "));

            return { response: '', toolCalls };
          }
        } catch {
          // No function calls, continue to text response
        }

        // Get text response
        const textResponse = response.text();
        span.setAttribute("response.type", "text");
        span.setAttribute("response.length", textResponse.length);

        return { response: textResponse.trim() };
      } catch (error) {
        if (error instanceof Error && error.message.includes('QUOTA_EXCEEDED')) {
          throw new Error("Gemini API quota exceeded. Please try again later.");
        }
        
        throw error;
      }
    },
    {
      input: {
        prompt: prompt.substring(0, 500), // Truncate for readability
        promptLength: prompt.length,
        conversationHistoryLength: conversationHistory.length,
        toolsCount: tools.length,
      },
      model: "gemini-2.0-flash",
      modelParameters: {
        temperature: 0.3,
        topP: 0.8,
        topK: 30,
        maxOutputTokens: 2000,
      },
      metadata: {
        provider: "google-genai",
        environment: process.env.NODE_ENV || "development",
      },
    }
  );
}