import { trace, context, SpanStatusCode, Span } from "@opentelemetry/api";
import { langfuseSpanProcessor } from "@/instrumentation";
import { 
  startActiveObservation, 
  updateActiveTrace,
  type LangfuseSpan, 
  type LangfuseGeneration 
} from "@langfuse/tracing";

// Get the tracer for the application
const tracer = trace.getTracer("resume-checker", "1.0.0");

/**
 * Create and manage a trace with proper naming and input/output tracking
 * Uses multiple approaches for maximum compatibility with Langfuse
 */
export async function withTrace<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    input?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Promise<T> {
  // Use Langfuse's native startActiveObservation for proper input/output tracking
  return startActiveObservation(
    name,
    async (observation: LangfuseSpan) => {
      // Update the trace name and input immediately
      updateActiveTrace({
        name: name,
        input: options?.input,
        metadata: options?.metadata,
      });

      console.log(`[Tracing] 📝 Starting trace: ${name}`);
      console.log(`[Tracing] 📥 Input:`, JSON.stringify(options?.input, null, 2));

      // Also create OTEL span for full observability
      return tracer.startActiveSpan(name, async (span) => {
        try {
          span.updateName(name);
          
          const inputData = options?.input;
          
          // Update Langfuse observation with input
          if (inputData) {
            observation.update({ input: inputData });
            span.setAttribute("langfuse.span.input", JSON.stringify(inputData));
            span.setAttribute("gen_ai.prompt", JSON.stringify(inputData));
          }

          if (options?.metadata) {
            observation.update({ metadata: options.metadata });
            Object.entries(options.metadata).forEach(([key, value]) => {
              span.setAttribute(key, String(value));
            });
          }

          // Execute the function
          const result = await fn(span);

          // Update Langfuse observation with output
          if (result !== undefined && result !== null) {
            let outputData;
            if (typeof result === 'object' && 'status' in result && 'headers' in result) {
              outputData = { 
                type: "http_response",
                status: (result as Record<string, unknown>).status || 200 
              };
            } else {
              outputData = result;
            }
            
            observation.update({ output: outputData });
            updateActiveTrace({ output: outputData });
            console.log(`[Tracing] 📤 Output:`, JSON.stringify(outputData, null, 2));
            span.setAttribute("langfuse.span.output", JSON.stringify(outputData));
            span.setAttribute("gen_ai.completion", JSON.stringify(outputData));
          }

          span.setStatus({ code: SpanStatusCode.OK });
          
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          
          span.setAttribute("error", true);
          span.setAttribute("error.message", error instanceof Error ? error.message : String(error));
          
          if (error instanceof Error && error.stack) {
            span.setAttribute("error.stack", error.stack);
          }

          observation.update({ 
            statusMessage: error instanceof Error ? error.message : String(error),
            level: "ERROR"
          });

          throw error;
        } finally {
          span.end();
          // Immediately flush after trace ends to ensure real-time updates in Langfuse
          await langfuseSpanProcessor.forceFlush().catch(err => 
            console.error("[Tracing] Failed to flush after trace:", err)
          );
        }
      });
    },
    {
      asType: "span",
      endOnExit: true
    }
  );
}

/**
 * Create a nested span within the current trace context
 * Uses Langfuse's observe wrapper for proper I/O tracking
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    input?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    spanType?: "generation" | "retrieval" | "tool" | "default";
  }
): Promise<T> {
  const observationType = 
    options?.spanType === "generation" ? "generation" : 
    options?.spanType === "retrieval" ? "retriever" :
    options?.spanType === "tool" ? "tool" : "span";

  return startActiveObservation(
    name,
    async (observation: LangfuseSpan) => {
      return tracer.startActiveSpan(name, async (span) => {
        try {
          span.updateName(name);
          if (options?.spanType) {
            span.setAttribute("langfuse.observation.type", options.spanType);
          }

          // Update Langfuse observation
          if (options?.input) {
            observation.update({ input: options.input });
            span.setAttribute("langfuse.span.input", JSON.stringify(options.input));
            span.setAttribute("gen_ai.prompt", JSON.stringify(options.input));
          }

          if (options?.metadata) {
            observation.update({ metadata: options.metadata });
            Object.entries(options.metadata).forEach(([key, value]) => {
              span.setAttribute(key, String(value));
            });
          }

          const result = await fn(span);

          if (result !== undefined && result !== null) {
            observation.update({ output: result });
            span.setAttribute("langfuse.span.output", JSON.stringify(result));
            span.setAttribute("gen_ai.completion", JSON.stringify(result));
          }

          span.setStatus({ code: SpanStatusCode.OK });
          
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          
          span.setAttribute("error", true);
          span.setAttribute("error.message", error instanceof Error ? error.message : String(error));

          observation.update({ 
            statusMessage: error instanceof Error ? error.message : String(error),
            level: "ERROR"
          });

          throw error;
        } finally {
          span.end();
        }
      });
    },
    {
      asType: observationType as "span",
      endOnExit: true
    }
  );
}

/**
 * Track an LLM generation with proper token usage and model parameters
 * Uses Langfuse's observe wrapper for proper generation tracking
 */
export async function withGeneration<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options: {
    input: Record<string, unknown>;
    model: string;
    modelParameters?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Promise<T> {
  return startActiveObservation(
    name,
    async (observation: LangfuseGeneration) => {
      return tracer.startActiveSpan(name, async (span) => {
        try {
          span.updateName(name);
          span.setAttribute("langfuse.observation.type", "generation");
          span.setAttribute("gen_ai.request.model", options.model);
          span.setAttribute("langfuse.span.model", options.model);
          
          // Update Langfuse generation observation
          observation.update({
            input: options.input,
            model: options.model,
            modelParameters: options.modelParameters as { [key: string]: string | number } | undefined,
            metadata: options.metadata
          });

          // Set in OTEL span as well
          span.setAttribute("langfuse.span.input", JSON.stringify(options.input));
          span.setAttribute("gen_ai.prompt", JSON.stringify(options.input));

          // Set model parameters
          if (options.modelParameters) {
            span.setAttribute("langfuse.span.model_parameters", JSON.stringify(options.modelParameters));
            Object.entries(options.modelParameters).forEach(([key, value]) => {
              span.setAttribute(`gen_ai.request.${key}`, String(value));
            });
          }

          // Set metadata
          if (options.metadata) {
            Object.entries(options.metadata).forEach(([key, value]) => {
              span.setAttribute(key, String(value));
            });
          }

          const result = await fn(span);

          // Set output in multiple formats
          if (result !== undefined && result !== null) {
            observation.update({ output: result });
            span.setAttribute("langfuse.span.output", JSON.stringify(result));
            span.setAttribute("gen_ai.completion", JSON.stringify(result));
          }

          span.setStatus({ code: SpanStatusCode.OK });
          
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          
          span.setAttribute("error", true);
          span.setAttribute("error.message", error instanceof Error ? error.message : String(error));

          observation.update({ 
            statusMessage: error instanceof Error ? error.message : String(error),
            level: "ERROR"
          });

          throw error;
        } finally {
          span.end();
        }
      });
    },
    {
      asType: "generation",
      endOnExit: true
    }
  );
}

/**
 * Set token usage on the current span
 */
export function setTokenUsage(span: Span, usage: {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}): void {
  span.setAttribute("gen_ai.usage.prompt_tokens", usage.promptTokens);
  span.setAttribute("gen_ai.usage.completion_tokens", usage.completionTokens);
  span.setAttribute("gen_ai.usage.total_tokens", usage.totalTokens);
}

/**
 * Flush all pending spans (important for serverless environments)
 */
export async function flushTraces(): Promise<void> {
  try {
    await langfuseSpanProcessor.forceFlush();
    console.log("[Tracing] ✅ All spans flushed successfully");
  } catch (error) {
    console.error("[Tracing] ❌ Failed to flush spans:", error);
    throw error;
  }
}

/**
 * Get the current active span from context
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active());
}
