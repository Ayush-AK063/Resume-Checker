import { NextResponse } from "next/server";
import { generateWithTools } from "@/lib/llm/gemini";
import { supabaseServer } from "@/supabase/serverClient";

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

const SYSTEM_PROMPT = `You are a resume evaluation assistant. 

RULES:
1. GREETINGS → Respond warmly
2. EVALUATION REQUESTS → Call get_resumes tool to fetch all resumes, then I will give you the data
3. OTHER QUESTIONS → Politely reject

WORKFLOW:
- When user mentions job requirements (like "I want Node.js developer"), call get_resumes tool
- I will fetch resumes and send you the complete data
- You will evaluate ALL resumes at once and return results in JSON format

EVALUATION INSTRUCTIONS:
When I provide resume data:
1. First check if each document is a VALID RESUME or not
   - A valid resume should contain: work experience, education, skills, or professional information
   - If document is NOT a resume (random text, articles, code, etc.), mark it clearly

2. Evaluate ALL documents and return a JSON array with this EXACT structure:
{
  "evaluations": [
    {
      "resumeId": "resume_id_here",
      "resumeName": "filename",
      "is_resume": true or false,
      "fit_score": 0-100,
      "feedback": "short feedback explaining score or why it's not a resume",
      "missing_skills": ["skill1", "skill2"],
      "status": "pass or fail (pass if score >= 50)"
    }
  ]
}

If "is_resume" is false, set:
- fit_score: 0
- feedback: "Not a valid resume document"
- missing_skills: []
- status: "fail"`;

export async function POST(req: Request) {
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

    // Only ONE tool - get_resumes
    const tools = [
      {
        name: "get_resumes",
        description:
          "Fetch all resumes from the database to evaluate against user requirements",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    // Step 1: LLM decides what to do
    const result = await generateWithTools(
      `${SYSTEM_PROMPT}\n\nUser: "${latestUserMessage}"`,
      conversationHistory,
      tools
    );

    // Step 2: If LLM called get_resumes tool
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls[0];

      if (toolCall.name === "get_resumes") {
        console.log("🚀 Step 1: User message received:", latestUserMessage);
        console.log("📞 Step 2: LLM called get_resumes tool");

        // Step 3: Backend fetches resumes from Supabase
        const { data: resumes, error } = await supabaseServer
          .from("resumes")
          .select("id, file_name, extracted_text")
          .order("created_at", { ascending: false });

        if (error || !resumes) {
          return NextResponse.json({
            response: "Failed to fetch resumes. Please try again.",
            evaluations: [],
          });
        }

        console.log(
          `� Step 3: Fetched ${resumes.length} resumes from database`
        );

        // Step 4: Send ALL resume data back to LLM for evaluation
        const evaluationPrompt = `User Requirement: "${latestUserMessage}"

I fetched ${resumes.length} resumes. Here is the complete data:

${resumes
  .map(
    (r, idx) => `
Resume ${idx + 1}:
ID: ${r.id}
Name: ${r.file_name}
Content: ${r.extracted_text}
---
`
  )
  .join("\n")}`;

        console.log(
          "🤖 Step 4: Sending all resume data to LLM for evaluation..."
        );

        // LLM evaluates everything at once - with system context
        const llmEvaluation = await generateWithTools(
          `${SYSTEM_PROMPT}\n\n${evaluationPrompt}`,
          [],
          []
        );

        console.log("✅ Step 5: LLM returned evaluation results");
        console.log("📄 Raw LLM Response:", llmEvaluation.response);

        // Parse LLM response
        let parsed;
        try {
          const jsonMatch = llmEvaluation.response.match(/\{[\s\S]*\}/);
          parsed = jsonMatch
            ? JSON.parse(jsonMatch[0])
            : JSON.parse(llmEvaluation.response);
          console.log(
            "✅ Parsed successfully:",
            JSON.stringify(parsed, null, 2)
          );
        } catch (parseError) {
          console.error("❌ Failed to parse LLM evaluation:", parseError);
          console.error("📄 Problematic response:", llmEvaluation.response);

          // Return detailed error with actual LLM response for debugging
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

        const evaluations: EvaluationResult[] = [];

        // Step 6: Save results to database and prepare response
        for (const evalData of parsed.evaluations || []) {
          try {
            const resume = resumes.find((r) => r.id === evalData.resumeId);
            if (!resume) continue;

            // Check if it's a valid resume
            const isValidResume = evalData.is_resume !== false; // Default to true if not specified

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
              raw_response: { ...evalData, ai_provider: "gemini" },
            });

            evaluations.push({
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

        const passed = evaluations.filter((e) => e.status === "pass").length;
        const failed = evaluations.filter((e) => e.status === "fail").length;

        console.log(
          `💾 Step 6: Saved ${evaluations.length} evaluations to database`
        );
        console.log(`🎉 Step 7: Complete! ${passed} passed, ${failed} failed`);

        // Step 7: Return results to frontend
        return NextResponse.json({
          response: `✅ **Evaluation Complete!**

📋 **Requirement:** ${latestUserMessage}

📊 **Results:**
- Total: ${evaluations.length}
- Passed: ${passed}
- Failed: ${failed}`,
          evaluations,
        });
      }
    }

    // Regular conversation response (no tool call)
    return NextResponse.json({
      response: result.response || "How can I help you with resume evaluation?",
      evaluations: [],
    });
  } catch (error) {
    console.error("❌ ERROR in chat-criteria API:", error);

    // Return detailed error for debugging
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
}
