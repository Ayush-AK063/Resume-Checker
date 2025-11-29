import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";
import { observe, updateActiveObservation, updateActiveTrace, startObservation } from "@langfuse/tracing";
import { after } from "next/server";
import { langfuseSpanProcessor } from "@/instrumentation";
import { deleteResumeChunks } from "@/lib/pinecone";

const handler = async (req: Request): Promise<NextResponse<{ message: string } | { error: string }>> => {
  try {
    const body = await req.json();
    const { resumeId }: { resumeId: string } = body;

    updateActiveTrace({
      name: `Delete Resume: ${resumeId}`,
      input: { resumeId },
      metadata: { feature: "delete-resume", apiEndpoint: "/api/deleteResume" },
      tags: ["resume-checker", "delete"],
    });

    updateActiveObservation({
      input: { resumeId },
    });

    if (!resumeId) {
      const errorOutput = { error: "Resume ID is required" };
      updateActiveObservation({
        output: errorOutput,
        level: "ERROR",
      });
      updateActiveTrace({
        output: errorOutput,
      });
      after(async () => await langfuseSpanProcessor.forceFlush());
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }

    // First, get the resume details to get the file path for deletion from storage
    const fetchSpan = startObservation(
      "fetch-resume-for-deletion",
      {
        input: { resumeId, query: "SELECT file_url FROM resumes WHERE id = ?" },
        metadata: { database: "supabase", table: "resumes" },
      },
      { asType: "span" }
    );

    const { data: resume, error: fetchError } = await supabaseServer
      .from("resumes")
      .select("file_url")
      .eq("id", resumeId)
      .single();

    fetchSpan.update({
      output: { found: !!resume, hasFileUrl: !!resume?.file_url, hasError: !!fetchError },
    });
    fetchSpan.end();

    if (fetchError) {
      const errorOutput = { error: "Resume not found", resumeId };
      updateActiveObservation({
        output: errorOutput,
        level: "ERROR",
      });
      updateActiveTrace({
        output: errorOutput,
      });
      after(async () => await langfuseSpanProcessor.forceFlush());
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
      const storageSpan = startObservation(
        "delete-from-storage",
        {
          input: { filePath, bucket: "resumes" },
          metadata: { storage: "supabase" },
        },
        { asType: "span" }
      );

      const { error: storageError } = await supabaseServer.storage
        .from('resumes')
        .remove([filePath]);

      storageSpan.update({
        output: { success: !storageError, deleted: !storageError },
      });
      storageSpan.end();

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete all evaluations first (due to foreign key constraint)
    const evalSpan = startObservation(
      "delete-evaluations",
      {
        input: { resumeId, query: "DELETE FROM evaluations WHERE resume_id = ?" },
        metadata: { database: "supabase", table: "evaluations" },
      },
      { asType: "span" }
    );

    const { error: evaluationsError } = await supabaseServer
      .from("evaluations")
      .delete()
      .eq("resume_id", resumeId);

    evalSpan.update({
      output: { success: !evaluationsError },
    });
    evalSpan.end();

    if (evaluationsError) {
      console.error('Error deleting evaluations:', evaluationsError);
      const errorOutput = { error: "Failed to delete resume evaluations", resumeId, details: evaluationsError.message };
      updateActiveObservation({
        output: errorOutput,
        level: "ERROR",
      });
      updateActiveTrace({
        output: errorOutput,
      });
      after(async () => await langfuseSpanProcessor.forceFlush());
      return NextResponse.json({ error: "Failed to delete resume evaluations" }, { status: 500 });
    }

    // Delete vectors from Pinecone
    const pineconeSpan = startObservation(
      "delete-vectors-from-pinecone",
      {
        input: { resumeId },
        metadata: { vectorDB: "pinecone" },
      },
      { asType: "span" }
    );

    try {
      await deleteResumeChunks(resumeId);
      pineconeSpan.update({
        output: { success: true, deletedVectors: true },
      });
    } catch (pineconeError) {
      console.error('Error deleting vectors from Pinecone:', pineconeError);
      pineconeSpan.update({
        output: { success: false, error: pineconeError instanceof Error ? pineconeError.message : String(pineconeError) },
      });
      // Continue with database deletion even if Pinecone deletion fails
    }
    pineconeSpan.end();

    // Delete the resume from the database
    const deleteSpan = startObservation(
      "delete-resume-from-db",
      {
        input: { resumeId, query: "DELETE FROM resumes WHERE id = ?" },
        metadata: { database: "supabase", table: "resumes" },
      },
      { asType: "span" }
    );

    const { error: deleteError } = await supabaseServer
      .from("resumes")
      .delete()
      .eq("id", resumeId);

    deleteSpan.update({
      output: { success: !deleteError },
    });
    deleteSpan.end();

    if (deleteError) {
      console.error('Error deleting resume:', deleteError);
      const errorOutput = { error: "Failed to delete resume", resumeId, details: deleteError.message };
      updateActiveObservation({
        output: errorOutput,
        level: "ERROR",
      });
      updateActiveTrace({
        output: errorOutput,
      });
      after(async () => await langfuseSpanProcessor.forceFlush());
      return NextResponse.json({ error: "Failed to delete resume" }, { status: 500 });
    }

    console.log('Resume deleted successfully:', resumeId);
    
    const successOutput = { 
      message: "Resume deleted successfully", 
      resumeId,
      deletedFile: !!filePath,
      deletedEvaluations: true,
      deletedVectors: true,
    };

    updateActiveObservation({
      output: successOutput,
    });

    updateActiveTrace({
      output: successOutput,
    });

    after(async () => await langfuseSpanProcessor.forceFlush());

    return NextResponse.json({ message: "Resume deleted successfully" });

  } catch (error) {
    console.error('DeleteResume error:', error);
    const errorOutput = {
      error: "Failed to delete resume",
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : String(error),
      timestamp: new Date().toISOString(),
    };

    updateActiveObservation({
      output: errorOutput,
      level: "ERROR",
    });

    updateActiveTrace({
      output: errorOutput,
    });

    after(async () => await langfuseSpanProcessor.forceFlush());

    return NextResponse.json({ error: "Failed to delete resume" }, { status: 500 });
  }
};

export const DELETE = observe(handler, {
  name: "delete-resume",
  captureInput: false,
  captureOutput: false,
  endOnExit: false,
});
