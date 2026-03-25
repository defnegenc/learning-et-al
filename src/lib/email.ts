import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Test-only recipient — remove this gate when ready for production
const TEST_EMAIL = "defnegenc@live.co.uk";

interface DigestEmailData {
  theme: string;
  synthesis: string;
  papers: { title: string; source: string; year?: number; summary?: string; sourceUrl?: string }[];
  digestUrl: string;
}

function buildHtml({ theme, synthesis, papers, digestUrl }: DigestEmailData): string {
  const paperCards = papers.map((p, i) => {
    const colors = ["#f9a8d4", "#93c5fd", "#c4b5fd"];
    const dot = colors[i % colors.length];
    const yearStr = p.year ? ` · ${p.year}` : "";
    const sourceLabel = p.source === "rss" ? "NEWS" : p.source === "arxiv" ? "ARXIV" : "PAPER";
    return `
      <div style="border: 2px solid #1a1a1a; padding: 16px; margin-bottom: 12px; background: white;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${dot}; display: inline-block;"></span>
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #999; font-family: monospace;">
            ${sourceLabel}${yearStr}
          </span>
        </div>
        <a href="${p.sourceUrl || digestUrl}" style="font-size: 15px; font-weight: 700; text-transform: uppercase; line-height: 1.3; color: #1a1a1a; text-decoration: none; font-family: 'Space Grotesk', sans-serif;">
          ${p.title}
        </a>
        ${p.summary ? `<p style="font-size: 13px; color: #555; line-height: 1.5; margin-top: 8px; border-left: 3px solid #e5e7eb; padding-left: 10px;">${p.summary}</p>` : ""}
      </div>`;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${theme}</title>
</head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
    <!-- Header -->
    <div style="margin-bottom: 24px;">
      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #888; font-family: monospace;">
        Learning et al.
      </span>
    </div>

    <!-- Theme -->
    <h1 style="font-size: 28px; font-weight: 800; line-height: 1.15; color: #1a1a1a; margin: 0 0 16px 0; font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em;">
      ${theme}
    </h1>

    <!-- Date -->
    <p style="font-size: 12px; color: #aaa; font-family: monospace; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px;">
      ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
    </p>

    <!-- Synthesis -->
    <div style="font-size: 16px; line-height: 1.85; color: #333; margin-bottom: 32px;">
      ${synthesis.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #111; font-weight: 700;">$1</strong>')}
    </div>

    <!-- Papers -->
    <div style="margin-bottom: 24px;">
      <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #555; font-family: monospace; display: block; margin-bottom: 12px;">
        Referenced Sources
      </span>
      ${paperCards}
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${digestUrl}" style="display: inline-block; padding: 14px 28px; background: #1a1a1a; color: white; text-decoration: none; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; font-family: monospace; border: 2px solid #1a1a1a;">
        Read Full Digest
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center;">
      <p style="font-size: 11px; color: #aaa; font-family: monospace;">
        Your daily research digest from <a href="https://learningetal.com" style="color: #888;">learningetal.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendDigestEmail(
  userEmail: string,
  data: DigestEmailData
): Promise<{ sent: boolean; error?: string }> {
  if (!resend) {
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  // Test gate: only send to test email during testing phase
  if (userEmail !== TEST_EMAIL) {
    return { sent: false, error: `Skipped — test mode, only sending to ${TEST_EMAIL}` };
  }

  try {
    await resend.emails.send({
      from: "Learning et al. <digest@learningetal.com>",
      to: userEmail,
      subject: data.theme,
      html: buildHtml(data),
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: String(err).slice(0, 200) };
  }
}
