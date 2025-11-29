import { LangfuseClient } from "@langfuse/client";

// Lazy singleton client to prevent build-time initialization issues.
let _langfuse: LangfuseClient | null = null;

function getLangfuseClient(): LangfuseClient {
  if (_langfuse) return _langfuse;

  const { LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_HOST } = process.env;
  if (!LANGFUSE_SECRET_KEY || !LANGFUSE_PUBLIC_KEY) {
    throw new Error("Langfuse environment variables missing (LANGFUSE_SECRET_KEY / LANGFUSE_PUBLIC_KEY). Set them before calling getPrompt.");
  }

  _langfuse = new LangfuseClient({
    secretKey: LANGFUSE_SECRET_KEY,
    publicKey: LANGFUSE_PUBLIC_KEY,
    baseUrl: LANGFUSE_HOST || "https://cloud.langfuse.com",
  });
  return _langfuse;
}

/**
 * Fetch a prompt from Langfuse by name at request time.
 */
export async function getPromptFromLangfuse(promptName: string): Promise<string> {
  const client = getLangfuseClient();
  const prompt = await client.getPrompt(promptName);
  return prompt.prompt as string;
}

/**
 * Fetch the evaluation system prompt.
 */
export async function getEvaluationPrompt(): Promise<string> {
  return getPromptFromLangfuse("evaluation");
}
