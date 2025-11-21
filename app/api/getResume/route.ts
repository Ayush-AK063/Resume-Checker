import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";
import { Resume, Evaluation } from "@/types";

type ResumeWithEvaluations = Resume & {
  evaluations: Evaluation[];
};

export async function GET(
  req: Request
): Promise<NextResponse<ResumeWithEvaluations | { error: string }>> {
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
}
