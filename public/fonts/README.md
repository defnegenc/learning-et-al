# Fonts

## The three faces

| Face | Role | How it ships |
|------|------|--------------|
| Cabinet Grotesk (Bold) | Display | Files in this directory, **gitignored**. Free from [Fontshare](https://www.fontshare.com/fonts/cabinet-grotesk) under the ITF Free Font License: free to self-host, but the license forbids redistributing the files, which is what committing them to a public repo would do. |
| Hanken Grotesk | Body | Variable font via `next/font/google` (self-hosted at build time, nothing needed here), plus one committed static `HankenGrotesk-Regular.ttf` for the Satori OG image, which cannot read variable fonts. OFL licensed (`OFL-HankenGrotesk.txt`), so committing it is fine. |
| Geist Mono | Labels | `next/font/google`, nothing needed here. |

## Cabinet Grotesk files

`CabinetGrotesk-Bold.woff2` (the site; both display styles are 700) and
`CabinetGrotesk-Bold.ttf` (the OG image; Satori cannot read woff2).

The code that references them (`globals.css`, `opengraph-image.tsx`) degrades
to system faces when they are absent, so the app builds and runs without them.

- **Local dev**: download from Fontshare and copy the files here by hand, or
  set `FONTS_BASE_URL` and run `node scripts/fetch-fonts.mjs`.
- **Vercel deploys**: set `FONTS_BASE_URL` in the project env to a private URL
  prefix (for example a private Vercel Blob store) that serves each file at
  `$FONTS_BASE_URL/<filename>`. The `prebuild` script downloads any files that
  are missing before `next build` runs.
