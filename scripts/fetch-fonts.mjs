// Downloads the licensed font files into public/fonts before `next build`.
// The files are not in git (see public/fonts/README.md); deploys get them from
// FONTS_BASE_URL, a private URL prefix serving each file at <base>/<name>.
// Missing fonts are never fatal: every reference in the app falls back to
// system faces, so a fork without the env var still builds.
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const FILES = [
  "CabinetGrotesk-Bold.woff2", // globals.css @font-face (both display styles are 700)
  "CabinetGrotesk-Bold.ttf", // opengraph-image.tsx (Satori can't read woff2)
];

const exists = (p) => access(p).then(() => true, () => false);

const missing = [];
for (const file of FILES) {
  if (!(await exists(path.join(FONT_DIR, file)))) missing.push(file);
}

if (missing.length === 0) {
  console.log("fetch-fonts: all font files present.");
  process.exit(0);
}

const base = process.env.FONTS_BASE_URL?.replace(/\/$/, "");
if (!base) {
  console.warn(
    `fetch-fonts: ${missing.length} font file(s) absent and FONTS_BASE_URL is unset; ` +
      "building with system-font fallbacks. See public/fonts/README.md.",
  );
  process.exit(0);
}

await mkdir(FONT_DIR, { recursive: true });
let failures = 0;
await Promise.all(
  missing.map(async (file) => {
    try {
      const res = await fetch(`${base}/${encodeURIComponent(file)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(path.join(FONT_DIR, file), Buffer.from(await res.arrayBuffer()));
      console.log(`fetch-fonts: downloaded ${file}`);
    } catch (err) {
      failures++;
      console.warn(`fetch-fonts: failed to fetch ${file}: ${err.message}`);
    }
  }),
);
console.log(
  `fetch-fonts: done (${missing.length - failures}/${missing.length} fetched).`,
);
