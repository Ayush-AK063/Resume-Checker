import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";
import { buildResumePrompt } from "@/lib/prompts/resumePrompt";
import { evaluateResume } from "@/lib/llm/gemini";
import { Criteria, Evaluation } from "@/types";

export async function POST(req: Request): Promise<NextResponse<Evaluation | { error: string }>> {
  try {
    
    const body = await req.json();
    const { resumeId, criteria }: { resumeId: string; criteria: Criteria } = body;

    if (!resumeId) {
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }

    if (!criteria || !criteria.role || !criteria.skills || !criteria.job_description) {
      return NextResponse.json({ error: "All criteria fields are required" }, { status: 400 });
    }

    const { data: resume, error: resumeError } = await supabaseServer
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .single();

    if (resumeError || !resume) {
      console.error('Resume fetch error:', resumeError);
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    if (!resume.extracted_text) {
      return NextResponse.json({ error: "Resume text not available" }, { status: 400 });
    }

    const prompt = buildResumePrompt(resume.extracted_text, criteria);

    const llmText = await evaluateResume(resume.extracted_text, prompt);

    let parsed;
    try {
      parsed = JSON.parse(llmText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });
    }

    const { data, error: insertError } = await supabaseServer
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
      return NextResponse.json({ error: "Failed to save evaluation" }, { status: 500 });
    }

    console.log('Evaluation completed successfully');
    return NextResponse.json(data);

  } catch (error) {
    console.error('CheckResume error:', error);
    
    // Handle specific Gemini API errors
    if (error && typeof error === 'object' && 'status' in error) {
      if (error.status === 429) {
        return NextResponse.json({ 
          error: "Gemini API quota exceeded. Please try again later." 
        }, { status: 429 });
      }
      if (error.status === 401) {
        return NextResponse.json({ 
          error: "Invalid Gemini API key. Please check your GEMINI_API_KEY configuration." 
        }, { status: 401 });
      }
    }

    // Provide helpful error messages
    let errorMessage = "Evaluation failed";
    if (!process.env.GEMINI_API_KEY) {
      errorMessage = "Gemini API key not configured. Please add GEMINI_API_KEY to your environment.";
    } else if (error instanceof Error) {
      errorMessage = `Evaluation failed: ${error.message}`;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
