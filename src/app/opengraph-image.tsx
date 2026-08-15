import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const alt = "Learning et al. — Color me curious.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1a1a1a";
const DIM = "#444444";

/* The ten spectrum slots, in hue order. Inlined rather than imported because
   this route runs in the edge renderer and must not pull in design-system.tsx,
   which is a client component: keep in step with `SPECTRUM` there. */
const SPECTRUM = [
  "#fecaca", "#fed7aa", "#fde68a", "#d9f99d", "#bbf7d0",
  "#99f6e4", "#bfdbfe", "#ddd6fe", "#f5d0fe", "#fbcfe8",
];

/* The slab, sized explicitly so the shadow's path can be measured. */
const SLAB = { w: 824, h: 172, d: 18 };

/**
 * The card's one shadow, at one depth, with the ten slots running round the
 * object's perimeter — bottom-left corner, right along the bottom, then up the
 * right edge. Segment lengths are proportional to the path, so the slab's width
 * takes most of the spectrum and the short right edge takes the rest.
 *
 * It has to be a layer rather than a `box-shadow` because CSS cannot recolour a
 * shadow across its own length. That means the object above it needs
 * `position: relative`, and this must be the FIRST child so it paints behind.
 *
 * This is the loader's move held still: on the site the stamp's single shadow
 * steps through four slots over time (`PageLoader` in design-system.tsx); a
 * static image can't step, so it shows the whole cycle at once. Colour still
 * only ever falls *behind* ink — it never fills anything, and it is never a
 * swatch. See "Two things colour may never be" in docs/design-style.md.
 */
function RingShadow({ w, h, d }: { w: number; h: number; d: number }) {
  const side = h - d;                                 // the right band's run
  const nBottom = Math.max(1, Math.min(9, Math.round((SPECTRUM.length * w) / (w + side))));
  const bottom = SPECTRUM.slice(0, nBottom);          // left → right
  const right = SPECTRUM.slice(nBottom).reverse();    // laid top → bottom, read bottom → up

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "absolute", top: d, left: d, width: w, height: h }}>
      <div style={{ display: "flex", height: side }}>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", width: d }}>
          {right.map((c) => <div key={c} style={{ display: "flex", flex: 1, background: c }} />)}
        </div>
      </div>
      <div style={{ display: "flex", height: d }}>
        {bottom.map((c) => <div key={c} style={{ display: "flex", flex: 1, background: c }} />)}
      </div>
    </div>
  );
}

const font = (file: string) =>
  readFile(path.join(process.cwd(), "public/fonts", file)).catch(() => null);

export default async function Image() {
  const [cabinet, apercu] = await Promise.all([
    font("CabinetGrotesk-Bold.ttf"),
    font("apercu_regular_pro.otf"),
  ]);

  const display = cabinet ? "Cabinet Grotesk" : "sans-serif";
  const body = apercu ? "Apercu Pro" : "sans-serif";

  return new ImageResponse(
    (
      /* White ground, no outer frame — an ink border at this size reads as a
         hairline artefact inside an iMessage bubble. The slab carries its own
         border, which is what keeps the card defined on a white background
         (Slack, Twitter) where the ground alone would disappear. */
      <div style={{
        width: "100%",
        height: "100%",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 72,
        padding: "0 40px 20px",
      }}>
        {/* The wordmark, boxed and tipped off-axis: the loader's square turned
            into a rubber stamp. The tip is what makes it playful; the border and
            the shadow are the two things the menu already allows it. */}
        <div style={{ display: "flex", position: "relative", transform: "rotate(-2.5deg)" }}>
          <RingShadow {...SLAB} />
          <div style={{
            display: "flex",
            position: "relative",
            width: SLAB.w,
            height: SLAB.h,
            background: "#ffffff",
            border: `5px solid ${INK}`,
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{
              display: "flex",
              fontFamily: display,
              fontSize: 100,
              fontWeight: 700,
              letterSpacing: "-0.045em",
              lineHeight: 1.0,
              color: INK,
            }}>
              Learning et al.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", fontFamily: body, fontSize: 38, color: DIM }}>
          Color me curious.
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
