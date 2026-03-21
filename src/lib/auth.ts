import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { users, accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // JWT strategy: session lives in an encrypted cookie, no sessions table needed.
  // This avoids the adapter session CRUD methods that were causing "Configuration" errors.
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // On first sign-in, persist user to DB and store userId in token
      if (user && account) {
        let dbUser = await db.query.users.findFirst({ where: eq(users.email, user.email!) });

        if (!dbUser) {
          const id = crypto.randomUUID();
          await db.insert(users).values({
            id,
            email: user.email!,
            name: user.name ?? null,
            image: user.image ?? null,
          });
          dbUser = { id, email: user.email!, name: user.name ?? null, image: user.image ?? null, createdAt: new Date(), timezone: "America/New_York", contentMix: 50, emailVerified: null };
        }

        // Link Google account if not already linked
        const existingAccount = await db.query.accounts.findFirst({
          where: and(eq(accounts.provider, account.provider), eq(accounts.providerAccountId, account.providerAccountId)),
        });
        if (!existingAccount) {
          await db.insert(accounts).values({
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token ?? null,
            access_token: account.access_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            session_state: typeof account.session_state === "string" ? account.session_state : null,
          });
        }

        token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
