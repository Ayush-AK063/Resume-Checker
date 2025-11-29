import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Initialize Langfuse span processor with immediate flush configuration
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  // Flush spans immediately for development - send after every span
  flushAt: 1,
  // Also flush every 1 second to ensure real-time updates
  flushInterval: 1000,
});

// OpenTelemetry SDK instance
let sdk: NodeSDK | null = null;

// Next.js instrumentation hook - runs before the server starts
export function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only initialize if not already initialized
    if (!process.env.OTEL_SDK_DISABLED && !sdk) {
      try {
        const hasLangfuseConfig = Boolean(
          process.env.LANGFUSE_SECRET_KEY && 
          process.env.LANGFUSE_PUBLIC_KEY
        );
        
        if (hasLangfuseConfig) {
          // Initialize OpenTelemetry SDK with proper configuration
          sdk = new NodeSDK({
            serviceName: "resume-checker",
            spanProcessors: [langfuseSpanProcessor],
          });
          
          sdk.start();
          console.log('[OpenTelemetry] ✅ SDK initialized with Langfuse exporter');
          console.log('[OpenTelemetry] 📊 Service: resume-checker');
          console.log('[OpenTelemetry] 🌍 Environment:', process.env.NODE_ENV || "development");
        } else {
          console.warn('[OpenTelemetry] ⚠️  Langfuse credentials not found');
        }
      } catch (error) {
        console.error('[OpenTelemetry] ❌ Failed to initialize SDK:', error);
      }
    } else if (process.env.OTEL_SDK_DISABLED) {
      console.log('[OpenTelemetry] SDK disabled via OTEL_SDK_DISABLED');
    }
  }
}

// Graceful shutdown handler
export async function onRequestError(): Promise<void> {
  if (sdk) {
    try {
      await langfuseSpanProcessor.forceFlush();
      console.log('[OpenTelemetry] 🔄 Spans flushed');
    } catch (error) {
      console.error('[OpenTelemetry] ❌ Error flushing spans:', error);
    }
  }
}

export function isOpenTelemetrySDKInitialized(): boolean {
  return sdk !== null;
}
