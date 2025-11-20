// app/api/uploadResume/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/supabase/serverClient";
import { extractText } from "@/lib/extract/detect";
import { Resume } from "@/types";

export async function POST(req: Request): Promise<NextResponse<{ resume: Resume } | { error: string }>> {
  try {
    console.log('Upload route started');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('No file provided');
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    console.log('File received:', file.name, file.type, file.size);

    const buffer = Buffer.from(await file.arrayBuffer());
    console.log('Buffer created, size:', buffer.length);

    const fileName = `${Date.now()}_${file.name}`;
    console.log('Uploading to storage with filename:', fileName);
    
    const { data: uploadData, error: uploadErr } = await supabaseServer.storage
      .from("resumes-bucket")
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
      });

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
    const extracted = await extractText(buffer, file.name);
    console.log('Text extracted, length:', extracted.length);

    console.log('Inserting into database...');
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

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    console.log('Resume inserted successfully:', data);
    return NextResponse.json({ resume: data });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}
