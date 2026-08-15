import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const alt = "Learning et al. — The digest that thinks.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1a1a1a";

/** SOURCE_PALETTES[0] and [1] — the card's colour, and now the only place the
 *  sweep bar survives: the digest headline moved to InkTitle (no colour). */
const SWEEP_1 = ["#6EE9A8", "#D4F04A"];
const SWEEP_2 = ["#FF85A8", "#FFD020"];

const font = (file: string) =>
  readFile(path.join(process.cwd(), "public/fonts", file)).catch(() => null);

/**
 * A phrase of the hero line with the gradient sweep bar under it. A static
 * image can't animate, so the card keeps the bars as its own device — the
 * digest headline itself no longer draws them.
 */
function Phrase({ text, colors, display }: { text: string; colors: string[]; display: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
      <div style={{ display: "flex", fontFamily: display, fontSize: 72, fontWeight: 700, letterSpacing: "-0.04em", color: INK }}>
        {text}
      </div>
      <div style={{
        display: "flex",
        height: 11,
        marginTop: -8,
        background: `linear-gradient(90deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
      }} />
    </div>
  );
}

export default async function Image() {
  const [cabinet, spaceGrotesk, apercu] = await Promise.all([
    font("CabinetGrotesk-Bold.ttf"),
    font("SpaceGrotesk-Bold.ttf"),
    font("apercu_regular_pro.otf"),
  ]);

  const display = cabinet ? "Cabinet Grotesk" : "sans-serif";
  const logo = spaceGrotesk ? "Space Grotesk" : "sans-serif";
  const body = apercu ? "Apercu Pro" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px 60px",
          border: `6px solid ${INK}`,
        }}
      >
        {/* Wordmark — the only uppercase on the card */}
        <div style={{
          display: "flex",
          fontFamily: logo,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: INK,
        }}>
          Learning et al.
        </div>

        {/* Hero — the digest question, swept like it is on the site — and one plain line under it */}
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 36 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Phrase text="One question a day." colors={SWEEP_1} display={display} />
            <Phrase text="Papers as tools to think with." colors={SWEEP_2} display={display} />
          </div>
          <div style={{
            display: "flex",
            fontFamily: body,
            fontSize: 26,
            lineHeight: 1.5,
            color: "#666",
            maxWidth: 820,
          }}>
            A daily research digest that finds, synthesizes and contrasts papers around one provocative question.
          </div>
        </div>

        <div style={{ display: "flex", fontFamily: body, fontSize: 22, color: INK }}>
          learningetal.com
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        cabinet && { name: "Cabinet Grotesk", data: cabinet.buffer as ArrayBuffer, weight: 700 as const, style: "normal" as const },
        spaceGrotesk && { name: "Space Grotesk", data: spaceGrotesk.buffer as ArrayBuffer, weight: 700 as const, style: "normal" as const },
        apercu && { name: "Apercu Pro", data: apercu.buffer as ArrayBuffer, weight: 400 as const, style: "normal" as const },
      ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[],
    }
  );
}
