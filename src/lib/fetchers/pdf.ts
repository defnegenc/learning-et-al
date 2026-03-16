import { PDFParse } from "pdf-parse";

export async function downloadAndParsePdf(pdfUrl: string): Promise<string> {
  try {
    const response = await fetch(pdfUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return result.text || "";
  } catch (e) {
    console.error(`Failed to parse PDF from ${pdfUrl}:`, e);
    return "";
  }
}
