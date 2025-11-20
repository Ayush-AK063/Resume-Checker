import { extractFromPDF } from "./pdf";
import { extractFromDocx } from "./docx";

export async function extractText(buffer: Buffer, filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "pdf") return extractFromPDF(buffer);
  if (ext === "doc" || ext === "docx") return extractFromDocx(buffer);

  return buffer.toString("utf-8");
}