# Fonts

## The three faces

| Face | Role | How it ships |
|------|------|--------------|
| Cabinet Grotesk (Bold) | Display | The site loads weight 700 through Fontshare's official API. The optional OG-image TTF is gitignored. |
| Hanken Grotesk | Body | Variable font via `next/font/google` (self-hosted at build time, nothing needed here), plus one committed static `HankenGrotesk-Regular.ttf` for the Satori OG image, which cannot read variable fonts. OFL licensed (`OFL-HankenGrotesk.txt`), so committing it is fine. |
| Geist Mono | Labels | `next/font/google`, nothing needed here. |

## Cabinet Grotesk

The browser face is served directly by Fontshare's official API, as permitted
by the ITF Free Font License. The binary is not redistributed in this public
repository.

`CabinetGrotesk-Bold.ttf` is optional and used only by the generated OG image,
because Satori cannot read the browser's remote CSS. Without it, the OG image
falls back to a system face while the site still uses Cabinet Grotesk.

- **Local OG images**: download the TTF from Fontshare and copy it here, or
  set `FONTS_BASE_URL` and run `node scripts/fetch-fonts.mjs`.
- **Vercel deploys**: set `FONTS_BASE_URL` in the project env to a private URL
  prefix (for example a private Vercel Blob store) that serves the TTF at
  `$FONTS_BASE_URL/<filename>`. The `prebuild` script downloads any files that
  are missing before `next build` runs.
