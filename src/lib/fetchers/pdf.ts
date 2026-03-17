import { extractText } from "unpdf";

export async function downloadAndParsePdf(pdfUrl: string): Promise<string> {
  try {
    const response = await fetch(pdfUrl);
    const buffer = new Uint8Array(await response.arrayBuffer());
    const { text } = await extractText(buffer);
    return Array.isArray(text) ? text.join("\n") : text;
  } catch (e) {
    console.error(`Failed to parse PDF from ${pdfUrl}:`, e);
    return "";
  }
}
