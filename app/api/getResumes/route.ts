import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";
import { Resume } from "@/types";
import { observe } from "@langfuse/tracing";

const handler = async (): Promise<NextResponse<Resume[] | { error: string }>> => {
  try {
    const { data, error } = await supabaseServer
      .from("resumes")
      .select("id, file_name, created_at")
      .order("created_at", { ascending: false });

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
  name: "GET /api/getResumes",
  captureInput: true,
  captureOutput: true,
});
