import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";

export async function DELETE(req: Request) {
  try {
    
    const body = await req.json();
    const { evaluationId } = body;

    if (!evaluationId) {
      return NextResponse.json({ error: "Evaluation ID is required" }, { status: 400 });
    }
    
    const { error } = await supabaseServer
      .from("evaluations")
      .delete()
      .eq("id", evaluationId);

    if (error) {
      console.error('Database delete error:', error);
      return NextResponse.json({ error: "Failed to delete evaluation" }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete evaluation error:', error);
    return NextResponse.json({ 
      error: `Failed to delete evaluation: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}
