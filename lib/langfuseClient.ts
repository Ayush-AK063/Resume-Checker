import { LangfuseClient } from "@langfuse/client";

// Initialize Langfuse client
export const langfuseClient = new LangfuseClient({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
});

/**
 * Fetch a prompt from Langfuse by name
 * @param promptName - The name of the prompt in Langfuse
 * @returns The prompt content as a string
 */
export async function getPromptFromLangfuse(promptName: string): Promise<string> {
  const prompt = await langfuseClient.getPrompt(promptName);
  return prompt.prompt as string;
}

/**
 * Fetch the evaluation prompt from Langfuse
 * @returns The evaluation prompt content
 */
export async function getEvaluationPrompt(): Promise<string> {
  return getPromptFromLangfuse("evaluation");
}
