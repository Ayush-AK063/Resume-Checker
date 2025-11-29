// app/api/uploadResume/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";
import { extractText } from "@/lib/extract/detect";
import { Resume } from "@/types";
import { observe, updateActiveObservation, updateActiveTrace, startObservation } from "@langfuse/tracing";
import { after } from "next/server";
import { langfuseSpanProcessor } from "@/instrumentation";
import { prepareChunksForEmbedding } from "@/lib/chunking";
import { generateEmbeddingsBatch } from "@/lib/embeddings";
import { storeResumeChunks } from "@/lib/pinecone";

const handler = async (req: Request): Promise<NextResponse<{ resume: Resume } | { error: string }>> => {
  try {
    console.log('Upload route started');

    updateActiveTrace({
      name: "resume-upload",
      metadata: { feature: "upload", apiEndpoint: "/api/uploadResume" },
      tags: ["resume-checker", "upload"],
    });
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('No file provided');
      updateActiveObservation({
        output: { error: "No file provided" },
        level: "ERROR",
      });
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    console.log('File received:', file.name, file.type, file.size);

    updateActiveObservation({
      input: { fileName: file.name, fileType: file.type, fileSize: file.size },
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    console.log('Buffer created, size:', buffer.length);

    const fileName = `${Date.now()}_${file.name}`;
    console.log('Uploading to storage with filename:', fileName);

    const storageSpan = startObservation(
      "upload-to-storage",
      {
        input: { fileName, bucket: "resumes-bucket", contentType: file.type },
        metadata: { storage: "supabase" },
      },
      { asType: "span" }
    );
    
    const { data: uploadData, error: uploadErr } = await supabaseServer.storage
      .from("resumes-bucket")
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
      });

    storageSpan.update({
      output: { success: !uploadErr, fileName: uploadData?.path },
    });
    storageSpan.end();

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return NextResponse.json({ error: `Storage error: ${uploadErr.message}` }, { status: 500 });
    }

    console.log('File uploaded successfully:', uploadData);

    const publicUrl = supabaseServer.storage
      .from("resumes-bucket")
      .getPublicUrl(fileName).data.publicUrl;

    console.log('Public URL generated:', publicUrl);

    console.log('Extracting text...');

    const extractSpan = startObservation(
      "extract-text-from-resume",
      {
        input: { fileName: file.name, fileType: file.type },
        metadata: { extractor: "detect" },
      },
      { asType: "span" }
    );

    const extracted = await extractText(buffer, file.name);

    extractSpan.update({
      output: { extractedLength: extracted.length, hasContent: extracted.length > 0 },
    });
    extractSpan.end();

    console.log('Text extracted, length:', extracted.length);

    console.log('Inserting into database...');

    const dbSpan = startObservation(
      "insert-resume-to-db",
      {
        input: { fileName: file.name, fileUrl: publicUrl, fileType: file.type },
        metadata: { database: "supabase", table: "resumes" },
      },
      { asType: "span" }
    );

    const { data, error } = await supabaseServer
      .from("resumes")
      .insert({
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        extracted_text: extracted,
      })
      .select()
      .single();

    dbSpan.update({
      output: { success: !error, resumeId: data?.id },
    });
    dbSpan.end();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    console.log('Resume inserted successfully:', data);

    // Step: Chunk the extracted text
    console.log('🔄 Chunking text for vector storage...');
    const chunkingSpan = startObservation(
      "chunk-text",
      {
        input: { textLength: extracted.length, maxTokens: 3000 },
        metadata: { chunker: "tiktoken" },
      },
      { asType: "span" }
    );

    const chunks = prepareChunksForEmbedding(extracted, 3000);
    
    chunkingSpan.update({
      output: { chunkCount: chunks.length },
    });
    chunkingSpan.end();

    console.log(`✅ Created ${chunks.length} chunks`);

    // Step: Generate embeddings for chunks
    console.log('🤖 Generating embeddings...');
    const embeddingSpan = startObservation(
      "generate-embeddings",
      {
        input: { chunkCount: chunks.length, model: "text-embedding-004" },
        metadata: { provider: "gemini" },
      },
      { asType: "generation" }
    );

    const embeddings = await generateEmbeddingsBatch(chunks.map(c => c.text));
    
    embeddingSpan.update({
      output: { embeddingCount: embeddings.length, dimension: embeddings[0]?.length || 0 },
    });
    embeddingSpan.end();

    console.log(`✅ Generated ${embeddings.length} embeddings`);

    // Step: Store in Pinecone
    console.log('📤 Storing vectors in Pinecone...');
    const pineconeSpan = startObservation(
      "store-vectors-pinecone",
      {
        input: { resumeId: data.id, vectorCount: chunks.length },
        metadata: { vectorDB: "pinecone" },
      },
      { asType: "span" }
    );

    const chunksWithEmbeddings = chunks.map((chunk, idx) => ({
      text: chunk.text,
      embedding: embeddings[idx],
      chunkIndex: chunk.chunkIndex,
    }));

    await storeResumeChunks(data.id, chunksWithEmbeddings, {
      fileName: file.name,
    });

    pineconeSpan.update({
      output: { success: true, vectorsStored: chunks.length },
    });
    pineconeSpan.end();

    console.log(`✅ Stored ${chunks.length} vectors in Pinecone for resume ${data.id}`);

    updateActiveObservation({
      output: { 
        resumeId: data.id, 
        fileName: data.file_name,
        chunksStored: chunks.length,
      },
    });

    after(async () => await langfuseSpanProcessor.forceFlush());

    return NextResponse.json({ resume: data });
  } catch (error) {
    updateActiveObservation({
      output: { error: error instanceof Error ? error.message : "Unknown error" },
      level: "ERROR",
    });
    console.log('Upload error:', error);

    after(async () => await langfuseSpanProcessor.forceFlush());

    return NextResponse.json({ 
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
};

// Wrap handler with observe
export const POST = observe(handler, {
  name: "upload-resume",
  captureInput: false,
  captureOutput: false,
  endOnExit: false,
});
