import { createHmac } from "crypto";

interface TweetDigestData {
  theme: string;
  lede?: string | null;
  papers: { title: string; sourceUrl?: string | null }[];
  digestId: string;
}

function oauthSign(method: string, url: string, params: Record<string, string>, secrets: { consumerSecret: string; tokenSecret: string }): string {
  const sorted = Object.keys(params).sort().map(k => `${encode(k)}=${encode(params[k])}`).join("&");
  const base = `${method}&${encode(url)}&${encode(sorted)}`;
  const key = `${encode(secrets.consumerSecret)}&${encode(secrets.tokenSecret)}`;
  return createHmac("sha1", key).update(base).digest("base64");
}

function encode(s: string) {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildAuthHeader(params: Record<string, string>): string {
  return "OAuth " + Object.keys(params)
    .filter(k => k.startsWith("oauth_"))
    .sort()
    .map(k => `${encode(k)}="${encode(params[k])}"`)
    .join(", ");
}

export async function postDigestToX(data: TweetDigestData): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return { ok: false, error: "X credentials not configured" };
  }

  const siteUrl = "https://learningetal.com";
  const link = `${siteUrl}/?digest=${data.digestId}`;

  // Strip markdown from lede (bold markers, source refs)
  const cleanLede = data.lede
    ? data.lede.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[Source \d+\]/gi, "").trim()
    : null;

  // Tweet: theme question + lede (if fits) or paper titles as fallback, + link
  let body: string;
  if (cleanLede) {
    // Truncate lede to leave room for theme + link (~220 chars budget for lede)
    const truncated = cleanLede.length > 220 ? cleanLede.slice(0, 217) + "…" : cleanLede;
    body = truncated;
  } else {
    body = data.papers
      .slice(0, 3)
      .map((p, i) => `${i + 1}. ${p.title.length > 60 ? p.title.slice(0, 57) + "…" : p.title}`)
      .join("\n");
  }

  const tweet = `${data.theme}\n\n${body}\n\n${link}`;

  const url = "https://api.twitter.com/2/tweets";
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams };
  oauthParams.oauth_signature = oauthSign("POST", url, allParams, { consumerSecret: apiSecret, tokenSecret: accessSecret });

  const authHeader = buildAuthHeader(oauthParams);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: tweet }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `X API ${res.status}: ${body.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
