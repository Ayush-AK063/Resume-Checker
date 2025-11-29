export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { generateWithTools } from "@/lib/llm/gemini";
import { supabaseServer } from "@/supabase/serverClient";
import { FunctionDeclarationSchemaType } from "@google/generative-ai";
import { withTrace, withSpan, flushTraces } from "@/lib/tracing";
import { getEvaluationPrompt } from "@/lib/langfuseClient";
import { searchResumeChunks } from "@/lib/pinecone";
import { generateQueryEmbedding } from "@/lib/embeddings";

interface ChatMessage {
  role: "user" | "bot";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
}

interface EvaluationResult {
  resumeId: string;
  resumeName: string;
  score: number;
  feedback: string;
  missing_skills: string[];
  status: "pass" | "fail";
  extractedCriteria: {
    role: string;
    skills: string[];
  };
}

export async function POST(req: Request) {
  return withTrace(
    "Resume Chat & Evaluation",
    async (traceSpan) => {
      try {
        const body: RequestBody = await req.json();
        const { messages } = body;

        if (!messages || messages.length === 0) {
          return NextResponse.json(
            { error: "Messages are required" },
            { status: 400 }
          );
        }

        const conversationHistory = messages.slice(0, -1).map((msg) => ({
          role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
          content: msg.content,
        }));

        const latestUserMessage = messages[messages.length - 1].content;

        traceSpan.setAttribute("user.message", latestUserMessage);
        traceSpan.setAttribute("conversation.message_count", messages.length);

        // Fetch the evaluation prompt from Langfuse
        const SYSTEM_PROMPT = await getEvaluationPrompt();
        traceSpan.setAttribute("prompt.source", "langfuse");
        traceSpan.setAttribute("prompt.name", "evaluation");

        // Tools available to the LLM
        const tools = [
          {
            name: "search_resumes",
            description:
              "Search for relevant resume sections using semantic search based on user's job requirements. Returns the most relevant chunks from all resumes.",
            parameters: {
              type: FunctionDeclarationSchemaType.OBJECT,
              properties: {
                query: {
                  type: FunctionDeclarationSchemaType.STRING,
                  description: "The search query describing job requirements or skills needed",
                },
                topK: {
                  type: FunctionDeclarationSchemaType.NUMBER,
                  description: "Number of most relevant chunks to return (default: 10)",
                },
              },
              required: ["query"],
            },
          },
        ];

        // Step 1: LLM decides what to do
        const result = await withSpan(
          "LLM Decision",
          async (span) => {
            span.setAttribute("step", "llm_decision");
            return generateWithTools(
              `${SYSTEM_PROMPT}\n\nUser: "${latestUserMessage}"`,
              conversationHistory,
              tools
            );
          },
          {
            input: {
              userMessage: latestUserMessage,
              conversationLength: conversationHistory.length,
            },
            spanType: "generation",
          }
        );

        // Step 2: If LLM called search_resumes tool
        if (result.toolCalls && result.toolCalls.length > 0) {
          const toolCall = result.toolCalls[0];

          if (toolCall.name === "search_resumes") {
            console.log("🚀 Step 1: User message received:", latestUserMessage);
            console.log("📞 Step 2: LLM called search_resumes tool");

            const searchQuery = toolCall.args?.query as string || latestUserMessage;
            const topK = (toolCall.args?.topK as number) || 10;

            console.log(`🔍 Search query: "${searchQuery}", topK: ${topK}`);

            // Step 3: Generate embedding for the query
            const queryEmbedding = await withSpan(
              "Generate Query Embedding",
              async (span) => {
                span.setAttribute("step", "query_embedding");
                span.setAttribute("query", searchQuery);
                
                return generateQueryEmbedding(searchQuery);
              },
              {
                input: { query: searchQuery },
                spanType: "generation",
              }
            );

            console.log(`✅ Step 3: Generated query embedding (dimension: ${queryEmbedding.length})`);

            // Step 4: Search Pinecone for relevant chunks
            const relevantChunks = await withSpan(
              "Search Pinecone",
              async (span) => {
                span.setAttribute("step", "pinecone_search");
                span.setAttribute("topK", topK);
                
                const results = await searchResumeChunks(queryEmbedding, topK);
                
                span.setAttribute("results.count", results.length);
                console.log(`✅ Step 4: Found ${results.length} relevant chunks from Pinecone`);
                
                return results;
              },
              {
                input: { topK, embeddingDimension: queryEmbedding.length },
                spanType: "retrieval",
              }
            );

            if (relevantChunks.length === 0) {
              return NextResponse.json({
                response: "❌ No relevant resume content found. Please upload resumes first.",
                evaluations: [],
              });
            }

            // Step 5: Group chunks by resume
            const resumeChunksMap = new Map<string, {
              resumeId: string;
              fileName: string;
              chunks: Array<{ text: string; score: number; chunkIndex: number }>;
            }>();

            for (const chunk of relevantChunks) {
              if (!resumeChunksMap.has(chunk.resumeId)) {
                resumeChunksMap.set(chunk.resumeId, {
                  resumeId: chunk.resumeId,
                  fileName: chunk.fileName,
                  chunks: [],
                });
              }
              resumeChunksMap.get(chunk.resumeId)!.chunks.push({
                text: chunk.text,
                score: chunk.score || 0,
                chunkIndex: chunk.chunkIndex,
              });
            }

            console.log(`📊 Step 5: Grouped chunks from ${resumeChunksMap.size} resumes`);

            // Step 6: Build context for LLM with relevant chunks
            const contextPrompt = `User Requirement: "${latestUserMessage}"

I found ${relevantChunks.length} relevant sections from ${resumeChunksMap.size} resumes:

${Array.from(resumeChunksMap.values())
  .map((resume, idx) => {
    const sortedChunks = resume.chunks.sort((a, b) => b.score - a.score);
    return `
Resume ${idx + 1}:
ID: ${resume.resumeId}
Name: ${resume.fileName}
Relevant Sections (${resume.chunks.length} chunks):
${sortedChunks.map((chunk, chunkIdx) => `
  Section ${chunkIdx + 1} (relevance: ${(chunk.score * 100).toFixed(1)}%):
  ${chunk.text}
`).join('\n')}
---`;
  })
  .join("\n")}

Please evaluate these resumes based on the user's requirements.`;

            console.log("🤖 Step 6: Sending relevant resume chunks to LLM for evaluation...");

            // LLM evaluates based on relevant chunks - with system context (prompt already fetched from Langfuse)
            const llmEvaluation = await withSpan(
              "LLM RAG Evaluation",
              async (span) => {
                span.setAttribute("step", "llm_rag_evaluation");
                span.setAttribute("resumes.count", resumeChunksMap.size);
                span.setAttribute("chunks.count", relevantChunks.length);
                span.setAttribute("prompt.source", "langfuse");
                
                return generateWithTools(
                  `${SYSTEM_PROMPT}\n\n${contextPrompt}`,
                  [],
                  []
                );
              },
              {
                input: {
                  requirement: latestUserMessage,
                  resumeCount: resumeChunksMap.size,
                  chunksCount: relevantChunks.length,
                },
                spanType: "generation",
              }
            );

            console.log("✅ Step 7: LLM returned evaluation results");
            console.log("📄 Raw LLM Response:", llmEvaluation.response);

            // Parse LLM response
            let parsed;
            try {
              const jsonMatch = llmEvaluation.response.match(/\{[\s\S]*\}/);
              parsed = jsonMatch
                ? JSON.parse(jsonMatch[0])
                : JSON.parse(llmEvaluation.response);
              console.log("✅ Parsed successfully:", JSON.stringify(parsed, null, 2));
            } catch (parseError) {
              console.error("❌ Failed to parse LLM evaluation:", parseError);
              console.error("📄 Problematic response:", llmEvaluation.response);

              return NextResponse.json({
                response: `❌ Failed to parse LLM response.\n\n**LLM returned:**\n${llmEvaluation.response.slice(
                  0,
                  500
                )}\n\n**Error:** ${
                  parseError instanceof Error
                    ? parseError.message
                    : "Unknown parse error"
                }`,
                evaluations: [],
                debug: {
                  rawResponse: llmEvaluation.response,
                  error:
                    parseError instanceof Error
                      ? parseError.message
                      : String(parseError),
                },
              });
            }

            // Step 8: Save results to database and prepare response
            const evaluations = await withSpan(
              "Save Evaluations to Database",
              async (span) => {
                span.setAttribute("step", "save_evaluations");
                
                const evalResults: EvaluationResult[] = [];

                for (const evalData of parsed.evaluations || []) {
                  try {
                    // Find resume in our chunks map
                    const resumeData = resumeChunksMap.get(evalData.resumeId);
                    if (!resumeData) continue;

                    // Check if it's a valid resume
                    const isValidResume = evalData.is_resume !== false;

                    // If not a resume, override status and feedback
                    let status: "pass" | "fail" =
                      evalData.fit_score >= 50 ? "pass" : "fail";
                    let feedback = evalData.feedback;

                    if (!isValidResume) {
                      status = "fail";
                      feedback = "❌ Not a valid resume document";
                    }

                    // Save to database
                    await supabaseServer
                      .from("evaluations")
                      .delete()
                      .eq("resume_id", evalData.resumeId);
                    await supabaseServer.from("evaluations").insert({
                      resume_id: evalData.resumeId,
                      criteria: {
                        role: "Not specified",
                        skills: [],
                        job_description: latestUserMessage,
                        is_resume: isValidResume,
                      },
                      fit_score: evalData.fit_score,
                      missing_skills: evalData.missing_skills || [],
                      feedback: feedback || "No feedback",
                      raw_response: { ...evalData, ai_provider: "gemini", rag_enabled: true },
                    });

                    evalResults.push({
                      resumeId: evalData.resumeId,
                      resumeName: evalData.resumeName,
                      score: evalData.fit_score,
                      feedback: feedback,
                      missing_skills: evalData.missing_skills || [],
                      status,
                      extractedCriteria: {
                        role: "Not specified",
                        skills: [],
                      },
                    });
                  } catch (err) {
                    console.error(
                      `Error saving evaluation for resume ${evalData.resumeId}:`,
                      err
                    );
                  }
                }

                span.setAttribute("evaluations.saved", evalResults.length);
                return evalResults;
              },
              {
                input: { evaluationCount: parsed.evaluations?.length || 0 },
                spanType: "default",
              }
            );

            const passed = evaluations.filter((e) => e.status === "pass").length;
            const failed = evaluations.filter((e) => e.status === "fail").length;

            console.log(`💾 Step 8: Saved ${evaluations.length} evaluations to database`);
            console.log(`🎉 Step 9: Complete! ${passed} passed, ${failed} failed`);

            traceSpan.setAttribute("evaluations.total", evaluations.length);
            traceSpan.setAttribute("evaluations.passed", passed);
            traceSpan.setAttribute("evaluations.failed", failed);
            traceSpan.setAttribute("rag.enabled", true);
            traceSpan.setAttribute("rag.chunks_used", relevantChunks.length);

            // Flush traces to ensure they're sent to Langfuse
            await flushTraces();

            // Step 9: Return results to frontend
            return NextResponse.json({
              response: `✅ **Evaluation Complete (RAG-Powered)!**

📋 **Requirement:** ${latestUserMessage}
🔍 **Analyzed:** ${relevantChunks.length} relevant sections from ${resumeChunksMap.size} resumes

📊 **Results:**
- Total: ${evaluations.length}
- Passed: ${passed}
- Failed: ${failed}`,
              evaluations,
            });
          }
        }

        // Regular conversation response (no tool call)
        traceSpan.setAttribute("response.type", "conversation");
        
        // Flush traces to ensure they're sent to Langfuse
        await flushTraces();
        
        return NextResponse.json({
          response: result.response || "How can I help you with resume evaluation?",
          evaluations: [],
        });
      } catch (error) {
        console.error("❌ ERROR in chat-criteria API:", error);

        const errorMessage =
          error instanceof Error ? error.message : "Internal server error";
        console.error("Error message:", errorMessage);

        return NextResponse.json(
          {
            error: errorMessage,
            details: error instanceof Error ? error.stack : String(error),
          },
          { status: 500 }
        );
      }
    },
    {
      input: {
        endpoint: "/api/chat-criteria",
        method: "POST",
      },
      metadata: {
        service: "resume-checker",
        feature: "chat-evaluation",
      },
    }
  );
}
