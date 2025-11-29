import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";
import { Resume, Evaluation } from "@/types";
import { observe } from "@langfuse/tracing";

type ResumeWithEvaluations = Resume & {
  evaluations: Evaluation[];
};

const handler = async (req: Request): Promise<NextResponse<ResumeWithEvaluations | { error: string }>> => {
  try {
    const { searchParams } = new URL(req.url);
    const resumeId = searchParams.get('id');

    if (!resumeId) {
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("resumes")
      .select("*, evaluations(*)")
      .eq("id", resumeId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = observe(handler, {
  name: "GET /api/getResume",
  captureInput: true,
  captureOutput: true,
});
