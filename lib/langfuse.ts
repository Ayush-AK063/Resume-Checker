import { flushTraces } from "@/lib/tracing";

// Helper function to ensure traces are flushed (important for serverless)
export async function flushLangfuse() {
  try {
    await flushTraces();
  } catch (error) {
    console.error("Failed to flush Langfuse:", error);
  }
}
