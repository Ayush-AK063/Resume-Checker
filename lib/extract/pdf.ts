import pdfParse from "pdf-parse";

export async function extractFromPDF(buffer: Buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (error) {
    console.error('PDF extraction error:', error);
    // Return a fallback message if PDF extraction fails
    return "PDF text extraction failed. Please try uploading a different file format.";
  }
}