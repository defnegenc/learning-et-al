import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface PaperData {
  title: string;
  source: string;
  year?: number;
  summary?: string;
  sourceUrl?: string;
  keywords?: string[];
}

export interface DigestEmailData {
  theme: string;
  synthesis: string;
  papers: PaperData[];
  digestId: string;
  date: string;
}

interface DigestSummary {
  theme: string;
  date: string;
  digestId: string;
}

type Cadence = "daily" | "biweekly" | "weekly";

const SITE_URL = "https://learningetal.com";

/*
 * The short menu, inlined for email.
 *
 * Mail clients strip <style> and CSS variables, so these have to be literals —
 * but they are the same literals as globals.css and must move with it. Two web
 * fonts can't be loaded either, so the display face falls back to the system
 * grotesque and the label face to a monospace stack; the geometry, the colour
 * and the hierarchy are what carry the brand here.
 */
const INK = "#1a1a1a";
const DIM = "#444444";
const MUTED = "#888888";
const RULE = "#dddddd";
const FIELD_BG = "#e8e8e8";
const SURFACE = "#ffffff";
/** Spectrum slots 00–09, hue-ordered. Card i takes slot i×3 and the next. */
const SPECTRUM = ["#fecaca", "#fed7aa", "#fde68a", "#d9f99d", "#bbf7d0", "#99f6e4", "#bfdbfe", "#ddd6fe", "#f5d0fe", "#fbcfe8"];
const washHues = (i: number): [string, string] => [SPECTRUM[(i * 3) % 10], SPECTRUM[(i * 3 + 1) % 10]];

const DISPLAY_FACE = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const BODY_FACE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const MONO_FACE = "ui-monospace,SFMono-Regular,Menlo,monospace";

/** Display/SM — card titles and every button. */
const DISPLAY_SM = `font-family:${DISPLAY_FACE};font-size:16px;font-weight:700;letter-spacing:-0.01em;line-height:20px;text-transform:uppercase;color:${INK};`;
/** Display/LG — the digest's question. */
const DISPLAY_LG = `font-family:${DISPLAY_FACE};font-size:32px;font-weight:700;letter-spacing:-0.02em;line-height:38px;color:${INK};`;
/** Label — mono eyebrows only. */
const LABEL = `font-family:${MONO_FACE};font-size:12px;font-weight:700;letter-spacing:0.12em;line-height:16px;text-transform:uppercase;color:${MUTED};`;
const BODY = `font-family:${BODY_FACE};font-size:15px;line-height:24px;color:${INK};`;
const BODY_SM = `font-family:${BODY_FACE};font-size:13px;line-height:20px;color:${INK};`;

const label = (text: string, extra = "") =>
  `<div style="${LABEL}${extra}">${text}</div>`;

/** The one button: ink fill, 2px frame, one hard 5px shadow. */
const cta = (href: string, text: string) =>
  `<div style="text-align:center;margin:28px 0 4px;">
     <a href="${href}" style="${DISPLAY_SM}display:inline-block;padding:12px 22px;background:${INK};color:${SURFACE};text-decoration:none;border:2px solid ${INK};box-shadow:5px 5px 0 0 ${INK};">${text}</a>
   </div>`;

/** The wordmark lockup — Display/SM with the label's tracking. */
const masthead = (right: string) =>
  `<div style="background:${INK};padding:14px 16px;">
     <span style="${DISPLAY_SM}color:${SURFACE};letter-spacing:0.12em;">Learning et al.</span>
     <span style="float:right;${LABEL}color:${RULE};line-height:20px;">${right}</span>
   </div>`;

const footer = () =>
  `<div style="text-align:center;padding:16px 0;">
     <p style="${BODY_SM}color:${MUTED};margin:0;">
       <a href="${SITE_URL}" style="color:${MUTED};text-decoration:none;">learningetal.com</a> ·
       <a href="${SITE_URL}" style="color:${MUTED};text-decoration:none;">manage preferences</a>
     </p>
   </div>`;

/** Bold in the synthesis is a paper's name — an ink underline, as on the site. */
const emphasise = (text: string) =>
  text.replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight:600;color:${INK};text-decoration:underline;">$1</strong>`);

/**
 * The compact paper card, in email. Same anatomy as the site's — title, byline,
 * tags — and the same wash index (position in the digest, never the field).
 * Mail clients drop radial-gradient, so the wash becomes a flat 6px band of the
 * card's two hues across the top: the colour still tells you which card this is.
 */
function paperCard(p: PaperData, i: number): string {
  const [h1, h2] = washHues(i);
  const venue = p.source === "rss" ? "News" : p.source === "arxiv" ? "arXiv" : "Paper";
  const byline = [venue, p.year ? String(p.year) : ""].filter(Boolean).join(", ");
  const keywords = (p.keywords || []).slice(0, 2).map(kw =>
    `<span style="${BODY_SM}font-weight:600;display:inline-block;padding:4px 10px;background:${SURFACE};border:1px solid ${INK};margin-right:6px;">${kw}</span>`
  ).join("");

  return `
    <div style="border:2px solid ${INK};margin-bottom:16px;background:${SURFACE};box-shadow:5px 5px 0 0 ${INK};">
      <div style="height:6px;background:${h1};border-bottom:2px solid ${INK};">
        <div style="width:50%;height:6px;background:${h2};margin-left:50%;"></div>
      </div>
      <div style="padding:16px 18px;">
        <a href="${p.sourceUrl || SITE_URL}" style="${DISPLAY_SM}text-decoration:none;display:block;margin-bottom:8px;">
          ${p.title}
        </a>
        <p style="${BODY_SM}font-style:italic;color:${DIM};margin:0 0 12px 0;">${byline}</p>
        ${p.summary ? `<p style="${BODY_SM}color:${DIM};margin:0 0 12px 0;">${p.summary.length > 140 ? p.summary.slice(0, 137) + "…" : p.summary}</p>` : ""}
        ${keywords ? `<div>${keywords}</div>` : ""}
      </div>
    </div>`;
}

function dailyEmail(data: DigestEmailData): string {
  const paperCards = data.papers.map((p, i) => paperCard(p, i)).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${FIELD_BG};${BODY}">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px;">
    ${masthead("Daily digest")}

    <!-- Main content -->
    <div style="background:${SURFACE};border:2px solid ${INK};border-top:none;padding:28px 24px;">
      ${label(data.date, "margin-bottom:14px;")}

      <h1 style="${DISPLAY_LG}margin:0 0 24px 0;">${data.theme}</h1>

      <div style="${BODY}margin-bottom:32px;">${emphasise(data.synthesis)}</div>

      <div style="margin-bottom:20px;">
        ${label("Referenced sources", "margin-bottom:14px;")}
        ${paperCards}
      </div>

      ${cta(`${SITE_URL}/digest/${data.digestId}`, "Read the digest →")}
    </div>

    ${footer()}
  </div>
</body></html>`;
}

function bestOfEmail(digests: DigestSummary[], bestDigest: DigestEmailData, cadence: "biweekly" | "weekly"): string {
  const periodLabel = cadence === "biweekly" ? "Bi-weekly" : "Weekly";
  const period = cadence === "biweekly" ? "this half-week" : "this week";

  const archiveList = digests.map(d => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${RULE};">
        <a href="${SITE_URL}/digest/${d.digestId}" style="${DISPLAY_SM}text-decoration:none;">${d.theme}</a>
        <div style="${BODY_SM}color:${MUTED};margin-top:4px;">${d.date}</div>
      </td>
    </tr>
  `).join("");

  const paperCards = bestDigest.papers.map((p, i) => paperCard(p, i)).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${FIELD_BG};${BODY}">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px;">
    ${masthead(`${periodLabel} best of`)}

    <!-- Best digest -->
    <div style="background:${SURFACE};border:2px solid ${INK};border-top:none;padding:28px 24px;">
      ${label(`Best of ${period} · ${bestDigest.date}`, "margin-bottom:14px;")}

      <h1 style="${DISPLAY_LG}margin:0 0 24px 0;">${bestDigest.theme}</h1>

      <div style="${BODY}margin-bottom:32px;">${emphasise(bestDigest.synthesis)}</div>

      <div style="margin-bottom:20px;">
        ${label("Referenced sources", "margin-bottom:14px;")}
        ${paperCards}
      </div>

      ${cta(`${SITE_URL}/digest/${bestDigest.digestId}`, "Read the digest →")}
    </div>

    <!-- Archive: other digests from this period -->
    ${digests.length > 1 ? `
    <div style="background:${SURFACE};border:2px solid ${INK};border-top:none;padding:20px 24px;">
      ${label(`Also from ${period}`, "margin-bottom:8px;")}
      <table style="width:100%;border-collapse:collapse;">
        ${archiveList}
      </table>
    </div>
    ` : ""}

    ${footer()}
  </div>
</body></html>`;
}

export function buildEmailHtml(
  cadence: Cadence,
  bestDigest: DigestEmailData,
  allDigests?: DigestSummary[]
): string {
  if (cadence === "daily") {
    return dailyEmail(bestDigest);
  }
  return bestOfEmail(allDigests || [{ theme: bestDigest.theme, date: bestDigest.date, digestId: bestDigest.digestId }], bestDigest, cadence);
}

export async function sendDigestEmail(
  userEmail: string,
  cadence: Cadence,
  bestDigest: DigestEmailData,
  allDigests?: DigestSummary[]
): Promise<{ sent: boolean; error?: string }> {
  if (!resend) {
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  // Recipient scoping (currently admin-only) is enforced by the caller (cron).

  const subject = cadence === "daily"
    ? bestDigest.theme
    : `Best of ${cadence === "biweekly" ? "the half-week" : "the week"}: ${bestDigest.theme}`;

  try {
    await resend.emails.send({
      from: "Learning et al. <digest@learningetal.com>",
      to: userEmail,
      subject,
      html: buildEmailHtml(cadence, bestDigest, allDigests),
      text: `${bestDigest.theme}\n\n${(bestDigest.synthesis || "").replace(/\*\*/g, "").replace(/\n{3,}/g, "\n\n")}\n\n---\nRead online: https://learningetal.com`,
      headers: {
        "List-Unsubscribe": "<https://learningetal.com/api/unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: String(err).slice(0, 200) };
  }
}
