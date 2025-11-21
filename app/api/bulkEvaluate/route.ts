import { supabaseServer } from "@/supabase/serverClient";
import { buildResumePrompt } from "@/lib/prompts/resumePrompt";
import { evaluateResume } from "@/lib/llm/gemini";
import { Criteria } from "@/types";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EvaluationProgress {
  type: 'progress' | 'result' | 'error' | 'complete';
  resumeId: string;
  resumeName: string;
  resumeUrl?: string;
  message?: string;
  evaluation?: {
    score: number;
    feedback: string;
    missing_skills: string[];
    status: 'pass' | 'fail';
  };
  error?: string;
  isNotResume?: boolean;
  summary?: {
    total: number;
    passed: number;
    failed: number;
    rejected: number;
    errors: number;
  };
}

export async function POST(req: Request) {
  try {
    console.log('📥 Bulk evaluate request received');
    
    const body = await req.json();
    console.log('📦 Request body:', { 
      hasResumeIds: !!body.resumeIds, 
      resumeCount: body.resumeIds?.length,
      hasCriteria: !!body.criteria,
      criteria: body.criteria 
    });
    
    const { resumeIds, criteria }: { resumeIds: string[]; criteria: Criteria } = body;

    if (!resumeIds || resumeIds.length === 0) {
      console.error('❌ No resume IDs provided');
      return new Response(JSON.stringify({ error: "Resume IDs are required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!criteria) {
      console.error('❌ No criteria provided');
      return new Response(JSON.stringify({ error: "Criteria is required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // More lenient validation - just need criteria object
    if (!criteria.role && (!criteria.skills || criteria.skills.length === 0)) {
      console.error('❌ Insufficient criteria - need role or skills');
      return new Response(JSON.stringify({ error: "Either role or skills must be provided in criteria" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Starting bulk evaluation for ${resumeIds.length} resumes with criteria:`, criteria);

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: EvaluationProgress) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        let passCount = 0;
        let failCount = 0;
        let rejectedCount = 0;
        let errorCount = 0;

        // Process each resume
        for (let i = 0; i < resumeIds.length; i++) {
          const resumeId = resumeIds[i];

          try {
            // Fetch resume
            const { data: resume, error: resumeError } = await supabaseServer
              .from("resumes")
              .select("*")
              .eq("id", resumeId)
              .single();

            if (resumeError || !resume) {
              console.error('Resume fetch error:', resumeError);
              sendEvent({
                type: 'error',
                resumeId,
                resumeName: `Resume ${i + 1}`,
                error: 'Resume not found'
              });
              errorCount++;
              continue;
            }

            // Send progress message
            sendEvent({
              type: 'progress',
              resumeId: resume.id,
              resumeName: resume.file_name,
              resumeUrl: resume.file_url,
              message: `Processing ${resume.file_name}...`
            });

            if (!resume.extracted_text) {
              sendEvent({
                type: 'error',
                resumeId: resume.id,
                resumeName: resume.file_name,
                resumeUrl: resume.file_url,
                error: 'Resume text not available'
              });
              errorCount++;
              continue;
            }

            // Evaluate resume
            const prompt = buildResumePrompt(resume.extracted_text, criteria);
            const llmText = await evaluateResume(resume.extracted_text, prompt);

            let parsed;
            try {
              parsed = JSON.parse(llmText);
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              sendEvent({
                type: 'error',
                resumeId: resume.id,
                resumeName: resume.file_name,
                resumeUrl: resume.file_url,
                error: 'Invalid AI response format'
              });
              errorCount++;
              continue;
            }

            // Check if the document is actually a resume
            if (parsed.is_resume === false) {
              console.log('Document rejected: Not a resume');
              sendEvent({
                type: 'error',
                resumeId: resume.id,
                resumeName: resume.file_name,
                resumeUrl: resume.file_url,
                error: 'This file does not appear to be a resume',
                isNotResume: true
              });
              rejectedCount++;
              continue;
            }

            // Delete any existing evaluations for this resume
            await supabaseServer
              .from("evaluations")
              .delete()
              .eq("resume_id", resumeId);

            // Save evaluation
            const { error: insertError } = await supabaseServer
              .from("evaluations")
              .insert({
                resume_id: resumeId,
                criteria,
                fit_score: parsed.fit_score,
                missing_skills: parsed.missing_skills,
                feedback: parsed.feedback,
                raw_response: { ...parsed, ai_provider: "gemini" },
              })
              .select()
              .single();

            if (insertError) {
              console.error('Database insert error:', insertError);
              sendEvent({
                type: 'error',
                resumeId: resume.id,
                resumeName: resume.file_name,
                resumeUrl: resume.file_url,
                error: 'Failed to save evaluation'
              });
              errorCount++;
              continue;
            }

            // Determine pass/fail status
            const status = parsed.fit_score >= 50 ? 'pass' : 'fail';
            if (status === 'pass') {
              passCount++;
            } else {
              failCount++;
            }

            // Send result
            sendEvent({
              type: 'result',
              resumeId: resume.id,
              resumeName: resume.file_name,
              resumeUrl: resume.file_url,
              evaluation: {
                score: parsed.fit_score,
                feedback: parsed.feedback,
                missing_skills: parsed.missing_skills,
                status
              }
            });

            // Small delay between evaluations to avoid overwhelming the API
            if (i < resumeIds.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

          } catch (error) {
            console.error('Error processing resume:', error);
            sendEvent({
              type: 'error',
              resumeId,
              resumeName: `Resume ${i + 1}`,
              error: error instanceof Error ? error.message : 'Unknown error occurred'
            });
            errorCount++;
          }
        }

        // Send completion message with summary
        sendEvent({
          type: 'complete',
          resumeId: '',
          resumeName: '',
          summary: {
            total: resumeIds.length,
            passed: passCount,
            failed: failCount,
            rejected: rejectedCount,
            errors: errorCount - rejectedCount
          }
        });

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Bulk evaluate error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
