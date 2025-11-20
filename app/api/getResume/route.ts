import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";
import { Resume, Evaluation } from "@/types";

type ResumeWithEvaluations = Resume & {
  evaluations: Evaluation[];
};

export async function POST(
  req: Request
): Promise<NextResponse<ResumeWithEvaluations | { error: string }>> {
  const { resumeId } = await req.json();

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
