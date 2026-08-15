import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const alt = "Learning et al. — The digest that thinks.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1a1a1a";
const DIM = "#444444";

/* Card 1 and card 2's wash hues — spectrum slots 0+1 and 3+4 — and now the only
   place the sweep bar survives, since the digest headline moved to InkTitle and
   carries no colour. Inlined rather than imported because this route runs in
   the edge renderer and must not pull a client component: keep in step with
   `washSlots` in design-system.tsx. */
const SWEEP_1 = ["#fecaca", "#fed7aa"];
const SWEEP_2 = ["#d9f99d", "#bbf7d0"];

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
  const [cabinet, apercu] = await Promise.all([
    font("CabinetGrotesk-Bold.ttf"),
    font("apercu_regular_pro.otf"),
  ]);

  const display = cabinet ? "Cabinet Grotesk" : "sans-serif";
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
          border: `4px solid ${INK}`,
        }}
      >
        {/* Wordmark — Display/SM with the label's tracking, the same lockup the
            site header draws. */}
        <div style={{
          display: "flex",
          fontFamily: display,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.12em",
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
            color: DIM,
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
        apercu && { name: "Apercu Pro", data: apercu.buffer as ArrayBuffer, weight: 400 as const, style: "normal" as const },
      ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[],
    }
  );
}
