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
  starred?: boolean;
}

type Cadence = "daily" | "biweekly" | "weekly";

const SITE_URL = "https://learningetal.com";

function paperCard(p: PaperData, i: number): string {
  const colors = ["#f9a8d4", "#93c5fd", "#c4b5fd"];
  const tagBgs = [["#fce7f3", "#dcfce7"], ["#dbeafe", "#fef9c3"], ["#ede9fe", "#fee2e2"]];
  const dot = colors[i % colors.length];
  const yearStr = p.year ? ` · ${p.year}` : "";
  const sourceLabel = p.source === "rss" ? "NEWS" : p.source === "arxiv" ? "ARXIV" : "PAPER";
  const keywords = (p.keywords || []).slice(0, 2).map((kw, ki) =>
    `<span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:700;text-transform:uppercase;font-family:monospace;background:${tagBgs[i % tagBgs.length][ki % 2]};border:1.5px solid #1a1a1a;margin-right:4px;">${kw}</span>`
  ).join("");

  return `
    <div style="border:2px solid #1a1a1a;padding:14px 16px;margin-bottom:10px;background:white;box-shadow:4px 4px 0px 0px rgba(0,0,0,1);">
      <div style="margin-bottom:6px;">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dot};vertical-align:middle;"></span>
        <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#999;font-family:monospace;vertical-align:middle;margin-left:4px;">
          ${sourceLabel}${yearStr}
        </span>
      </div>
      <a href="${p.sourceUrl || SITE_URL}" style="font-size:14px;font-weight:700;text-transform:uppercase;line-height:1.3;color:#1a1a1a;text-decoration:none;display:block;margin-bottom:6px;">
        ${p.title}
      </a>
      ${p.summary ? `<p style="font-size:12px;color:#555;line-height:1.5;margin:0 0 8px 0;border-left:3px solid #e5e7eb;padding-left:8px;">${p.summary.length > 140 ? p.summary.slice(0, 137) + "..." : p.summary}</p>` : ""}
      ${keywords ? `<div>${keywords}</div>` : ""}
    </div>`;
}

function dailyEmail(data: DigestEmailData): string {
  const paperCards = data.papers.map((p, i) => paperCard(p, i)).join("");
  const synthesisHtml = data.synthesis.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#111;font-weight:700;background:rgba(249,168,212,0.2);padding:1px 3px;">$1</strong>');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:20px 12px;">
    <!-- Header bar -->
    <div style="background:#1a1a1a;padding:12px 16px;margin-bottom:0;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:white;font-family:monospace;">Learning et al.</span>
      <span style="font-size:10px;color:#888;font-family:monospace;">DAILY DIGEST</span>
    </div>

    <!-- Main content -->
    <div style="background:white;border:2px solid #1a1a1a;border-top:none;padding:24px 20px;">
      <!-- Theme -->
      <h1 style="font-size:24px;font-weight:800;line-height:1.15;color:#1a1a1a;margin:0 0 8px 0;letter-spacing:-0.02em;">
        ${data.theme}
      </h1>

      <p style="font-size:11px;color:#aaa;font-family:monospace;text-transform:uppercase;letter-spacing:1px;margin:0 0 20px 0;">
        ${data.date}
      </p>

      <!-- Synthesis -->
      <div style="font-size:15px;line-height:1.85;color:#333;margin-bottom:24px;">
        ${synthesisHtml}
      </div>

      <!-- Sources -->
      <div style="margin-bottom:20px;">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#555;font-family:monospace;display:block;margin-bottom:10px;">
          Referenced Sources
        </span>
        ${paperCards}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${SITE_URL}/digest/${data.digestId}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:white;text-decoration:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;font-family:monospace;border:2px solid #1a1a1a;box-shadow:4px 4px 0px 0px rgba(0,0,0,1);">
          Dig Deeper →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:12px 0;">
      <p style="font-size:10px;color:#aaa;font-family:monospace;margin:0;">
        <a href="${SITE_URL}" style="color:#888;text-decoration:none;">learningetal.com</a> · <a href="${SITE_URL}" style="color:#888;text-decoration:none;">manage preferences</a>
      </p>
    </div>
  </div>
</body></html>`;
}

function bestOfEmail(digests: DigestSummary[], bestDigest: DigestEmailData, cadence: "biweekly" | "weekly"): string {
  const label = cadence === "biweekly" ? "BI-WEEKLY" : "WEEKLY";
  const period = cadence === "biweekly" ? "this half-week" : "this week";

  const archiveList = digests.map(d => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee;">
        <a href="${SITE_URL}/digest/${d.digestId}" style="font-size:13px;font-weight:600;color:#1a1a1a;text-decoration:none;">
          ${d.theme}
        </a>
        <span style="font-size:10px;color:#aaa;font-family:monospace;margin-left:6px;">${d.date}</span>
        ${d.starred ? ' <span style="color:#f59e0b;">★</span>' : ""}
      </td>
    </tr>
  `).join("");

  const paperCards = bestDigest.papers.map((p, i) => paperCard(p, i)).join("");
  const synthesisHtml = bestDigest.synthesis.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#111;font-weight:700;background:rgba(249,168,212,0.2);padding:1px 3px;">$1</strong>');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:20px 12px;">
    <!-- Header bar -->
    <div style="background:#1a1a1a;padding:12px 16px;margin-bottom:0;">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:white;font-family:monospace;">Learning et al.</span>
      <span style="float:right;font-size:10px;color:#888;font-family:monospace;">${label} BEST OF</span>
    </div>

    <!-- Best digest -->
    <div style="background:white;border:2px solid #1a1a1a;border-top:none;padding:24px 20px;">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#888;font-family:monospace;display:block;margin-bottom:8px;">
        ★ Best of ${period}
      </span>

      <h1 style="font-size:24px;font-weight:800;line-height:1.15;color:#1a1a1a;margin:0 0 8px 0;letter-spacing:-0.02em;">
        ${bestDigest.theme}
      </h1>

      <p style="font-size:11px;color:#aaa;font-family:monospace;text-transform:uppercase;letter-spacing:1px;margin:0 0 20px 0;">
        ${bestDigest.date}
      </p>

      <div style="font-size:15px;line-height:1.85;color:#333;margin-bottom:24px;">
        ${synthesisHtml}
      </div>

      <div style="margin-bottom:20px;">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#555;font-family:monospace;display:block;margin-bottom:10px;">
          Referenced Sources
        </span>
        ${paperCards}
      </div>

      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${SITE_URL}/digest/${bestDigest.digestId}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:white;text-decoration:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;font-family:monospace;border:2px solid #1a1a1a;box-shadow:4px 4px 0px 0px rgba(0,0,0,1);">
          Dig Deeper →
        </a>
      </div>
    </div>

    <!-- Archive: other digests from this period -->
    ${digests.length > 1 ? `
    <div style="background:white;border:2px solid #1a1a1a;border-top:none;padding:16px 20px;">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#555;font-family:monospace;display:block;margin-bottom:8px;">
        Also from ${period}
      </span>
      <table style="width:100%;border-collapse:collapse;">
        ${archiveList}
      </table>
    </div>
    ` : ""}

    <!-- Footer -->
    <div style="text-align:center;padding:12px 0;">
      <p style="font-size:10px;color:#aaa;font-family:monospace;margin:0;">
        <a href="${SITE_URL}" style="color:#888;text-decoration:none;">learningetal.com</a> · <a href="${SITE_URL}" style="color:#888;text-decoration:none;">manage preferences</a>
      </p>
    </div>
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
    : `★ Best of ${cadence === "biweekly" ? "the half-week" : "the week"}: ${bestDigest.theme}`;

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
