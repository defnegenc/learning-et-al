# Public Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy Learning et al. publicly with a logged-out experience showing the admin's daily digest, Google auth for personal accounts, and Turso DB for production.

**Architecture:** Logged-out visitors see the admin user's latest digest (read-only). Sign up via Google OAuth to get personal digests with your own interests + API key. SQLite swapped to Turso (libsql) for production. Admin user identified by env var `ADMIN_USER_ID`.

**Tech Stack:** Next.js 16, Auth.js (next-auth v5), Turso (libsql), Drizzle ORM, Vercel

---

### Task 1: Swap SQLite to Turso (libsql)

**Files:**
- Modify: `package.json` (swap better-sqlite3 for @libsql/client)
- Modify: `src/lib/db/index.ts` (swap driver)
- Modify: `drizzle.config.ts` (swap dialect)
- Create: `.env.example`

**Step 1:** Install libsql + drizzle libsql driver

```bash
npm install @libsql/client drizzle-orm
npm uninstall better-sqlite3 @types/better-sqlite3
npm install -D @libsql/client
```

**Step 2:** Update `src/lib/db/index.ts`

```typescript
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:paper-processor.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

**Step 3:** Update `drizzle.config.ts`

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "file:paper-processor.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
```

**Step 4:** Create `.env.example`

```
SERPER_API_KEY=
TURSO_DATABASE_URL=file:paper-processor.db
TURSO_AUTH_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=
ADMIN_USER_ID=
```

**Step 5:** Test locally — `npm run dev` should still work with `file:paper-processor.db`

**Step 6:** Create Turso database

```bash
turso db create learning-et-al
turso db tokens create learning-et-al
turso db show learning-et-al --url
```

Add URL + token to `.env.local`, run `npx drizzle-kit push`

---

### Task 2: Add Google OAuth with Auth.js

**Files:**
- Create: `src/lib/auth.ts` (auth config)
- Create: `src/app/api/auth/[...nextauth]/route.ts` (auth route)
- Modify: `src/lib/db/schema.ts` (add email + name to users, add accounts table)
- Modify: `src/app/api/setup/route.ts` (link to auth session instead of random UUID)

**Step 1:** Install auth.js

```bash
npm install next-auth@beta @auth/drizzle-adapter
```

**Step 2:** Create `src/lib/auth.ts`

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
```

**Step 3:** Create `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

**Step 4:** Update schema — add Auth.js required tables (accounts, sessions, verification_tokens) and add `email`, `name`, `image` to users

**Step 5:** Run `npx drizzle-kit push` to apply schema changes

---

### Task 3: Auth middleware — protect routes, allow public digest

**Files:**
- Create: `src/middleware.ts` (Next.js middleware)
- Modify: ALL API routes (swap cookie-based auth for session-based)
- Create: `src/lib/get-user.ts` (shared helper)

**Step 1:** Create `src/lib/get-user.ts`

```typescript
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function getAuthUser(req?: NextRequest): Promise<string | null> {
  // Try Auth.js session first
  const session = await auth();
  if (session?.user?.id) return session.user.id;
  // Fall back to cookie (for migration period)
  if (req) {
    const cookieId = req.cookies.get("user_id")?.value;
    if (cookieId) return cookieId;
  }
  return null;
}
```

**Step 2:** Update every API route — replace `req.cookies.get("user_id")?.value` with `await getAuthUser(req)`

Routes to update (13 files):
- `src/app/api/digest/route.ts`
- `src/app/api/digest/generate/route.ts`
- `src/app/api/digest/chat/route.ts`
- `src/app/api/digest/star/route.ts`
- `src/app/api/vault/route.ts`
- `src/app/api/vault/compare/route.ts`
- `src/app/api/interests/route.ts`
- `src/app/api/interests/add/route.ts`
- `src/app/api/papers/[id]/qa/route.ts`
- `src/app/api/papers/[id]/feedback/route.ts`
- `src/app/api/papers/[id]/related/route.ts`
- `src/app/api/setup/route.ts`

---

### Task 4: Public logged-out experience

**Files:**
- Create: `src/app/api/public/digest/route.ts` (serves admin's latest digest, no auth)
- Modify: `src/app/page.tsx` (show public digest when logged out instead of onboarding)
- Create: `src/components/public-digest.tsx` (read-only digest view)

**Step 1:** Create public digest API — serves the admin user's latest digest

```typescript
// src/app/api/public/digest/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { digests, papers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

const ADMIN_ID = process.env.ADMIN_USER_ID || "";

export async function GET() {
  if (!ADMIN_ID) return NextResponse.json({ digest: null, papers: [] });

  const digest = await db.query.digests.findFirst({
    where: eq(digests.userId, ADMIN_ID),
    orderBy: desc(digests.createdAt),
  });
  if (!digest) return NextResponse.json({ digest: null, papers: [] });

  const digestPapers = await db.query.papers.findMany({
    where: eq(papers.digestId, digest.id),
  });

  return NextResponse.json({
    digest: { ...digest, keyConcepts: digest.keyConcepts ? JSON.parse(digest.keyConcepts) : [] },
    papers: digestPapers.map(p => ({
      ...p,
      authors: p.authors ? JSON.parse(p.authors) : [],
      keywords: p.keywords ? JSON.parse(p.keywords) : [],
      keyFindings: p.keyFindings ? JSON.parse(p.keyFindings) : [],
    })),
  });
}
```

**Step 2:** Create `src/components/public-digest.tsx` — reuses SynthesisBanner + PaperCard but read-only (no star, no regenerate, no chat). Shows a "Sign up to get personalized digests" CTA.

**Step 3:** Update `src/app/page.tsx` flow:

```
if (loading) → spinner
if (authenticated) → <AppShell />
if (not authenticated) → <PublicDigest /> with sign-in CTA
```

---

### Task 5: Sign in / Sign up UI

**Files:**
- Modify: `src/components/app-shell.tsx` (add sign out button)
- Modify: `src/components/public-digest.tsx` (add sign in button)
- Create: `src/app/auth/signin/page.tsx` (optional custom sign-in page)

**Step 1:** Add Google sign-in button to public digest page

**Step 2:** Add sign-out to settings sidebar

**Step 3:** After first Google sign-in, redirect to onboarding (interests picker) if user has no interests yet

---

### Task 6: Vercel deployment

**Files:**
- Create: `vercel.json` (if needed)
- Modify: `next.config.ts` (ensure compatible settings)

**Step 1:** Push to GitHub

**Step 2:** Connect to Vercel, set environment variables:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `SERPER_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET` (generate with `npx auth secret`)
- `ADMIN_USER_ID`

**Step 3:** Deploy, test logged-out view, test Google sign-in, test digest generation

---

## Execution Order

1. **Task 1** (Turso) — swap DB, verify local still works
2. **Task 2** (Auth.js) — add Google OAuth
3. **Task 3** (Middleware) — protect routes, shared auth helper
4. **Task 4** (Public digest) — logged-out experience
5. **Task 5** (UI) — sign in/out buttons, onboarding flow
6. **Task 6** (Deploy) — Vercel + env vars

Each task is independently testable. Tasks 1-3 are backend-only. Tasks 4-5 are UI. Task 6 is deployment.
