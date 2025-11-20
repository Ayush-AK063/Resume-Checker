import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";
import { Resume } from "@/types";

export async function GET(): Promise<NextResponse<Resume[] | { error: string }>> {
  const { data, error } = await supabaseServer
    .from("resumes")
    .select("id, file_name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
