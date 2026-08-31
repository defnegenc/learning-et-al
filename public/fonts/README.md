# Fonts

The font files that live in this directory are licensed, not open source, so
they are gitignored and never committed. The code that references them
(`globals.css`, `opengraph-image.tsx`, `email.ts` fallback stacks) degrades to
system fonts when they are absent, so the app builds and runs without them.

## The faces

| File | Face | License |
|------|------|---------|
| `apercu_regular_pro.otf`, `apercu_regular_italic_pro.otf`, `apercu_medium_pro.otf`, `apercu_medium_italic_pro.otf`, `apercu_bold_pro.otf`, `apercu_bold_italic_pro.otf` | Apercu Pro (body) | Commercial, from [Colophon Foundry](https://www.colophon-foundry.org/typefaces/apercu). Self-hosting on your own site requires their web license. |
| `CabinetGrotesk-Regular.woff2`, `CabinetGrotesk-Medium.woff2`, `CabinetGrotesk-Bold.woff2`, `CabinetGrotesk-Bold.ttf`, `CabinetGrotesk-Extrabold.woff2` | Cabinet Grotesk (display) | Free from [Fontshare](https://www.fontshare.com/fonts/cabinet-grotesk) under the ITF Free Font License. Free to self-host, but the license forbids redistributing the files, which is what committing them to a public repo would do. |

Geist Mono (labels) is loaded through `next/font` from the `geist` package and
needs no files here.

## Getting the files

- **Local dev**: copy the files into this directory by hand, or set
  `FONTS_BASE_URL` (see below) and run `node scripts/fetch-fonts.mjs`.
- **Vercel deploys**: set `FONTS_BASE_URL` in the project env to a private URL
  prefix (for example a private Vercel Blob store or object bucket) that serves
  each file at `$FONTS_BASE_URL/<filename>`. The `prebuild` script downloads
  any files that are missing before `next build` runs.

If you are forking this project and have no Apercu license, the cleanest swap
is a free grotesque with similar warmth (for example Hanken Grotesk or
Instrument Sans via Fontshare/Google Fonts): update the `@font-face` blocks in
`src/app/globals.css`, the file list in `scripts/fetch-fonts.mjs`, and the
lookups in `src/app/opengraph-image.tsx`.
