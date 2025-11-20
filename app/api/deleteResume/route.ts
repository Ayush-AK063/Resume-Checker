import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";

export async function DELETE(req: Request): Promise<NextResponse<{ message: string } | { error: string }>> {
  try {
    const body = await req.json();
    const { resumeId }: { resumeId: string } = body;

    if (!resumeId) {
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }

    // First, get the resume details to get the file path for deletion from storage
    const { data: resume, error: fetchError } = await supabaseServer
      .from("resumes")
      .select("file_url")
      .eq("id", resumeId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    // Extract file path from the file_url for storage deletion
    let filePath: string | null = null;
    if (resume?.file_url) {
      try {
        const url = new URL(resume.file_url);
        const pathParts = url.pathname.split('/');
        // The file path is typically after '/storage/v1/object/public/resumes/'
        const resumesIndex = pathParts.indexOf('resumes');
        if (resumesIndex !== -1 && resumesIndex < pathParts.length - 1) {
          filePath = pathParts.slice(resumesIndex + 1).join('/');
        }
      } catch (urlError) {
        console.error('Error parsing file URL:', urlError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from storage bucket if file path is available
    if (filePath) {
      const { error: storageError } = await supabaseServer.storage
        .from('resumes')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete all evaluations first (due to foreign key constraint)
    const { error: evaluationsError } = await supabaseServer
      .from("evaluations")
      .delete()
      .eq("resume_id", resumeId);

    if (evaluationsError) {
      console.error('Error deleting evaluations:', evaluationsError);
      return NextResponse.json({ error: "Failed to delete resume evaluations" }, { status: 500 });
    }

    // Delete the resume from the database
    const { error: deleteError } = await supabaseServer
      .from("resumes")
      .delete()
      .eq("id", resumeId);

    if (deleteError) {
      console.error('Error deleting resume:', deleteError);
      return NextResponse.json({ error: "Failed to delete resume" }, { status: 500 });
    }

    console.log('Resume deleted successfully:', resumeId);
    return NextResponse.json({ message: "Resume deleted successfully" });

  } catch (error) {
    console.error('DeleteResume error:', error);
    return NextResponse.json({ error: "Failed to delete resume" }, { status: 500 });
  }
}
