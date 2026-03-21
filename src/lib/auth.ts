import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { users, accounts, sessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { Adapter } from "next-auth/adapters";

// Custom minimal adapter — avoids DrizzleAdapter's column name assumptions
const adapter: Adapter = {
  async createUser(data) {
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      email: data.email,
      name: data.name ?? null,
      image: data.image ?? null,
      emailVerified: data.emailVerified ?? null,
    });
    return { id, email: data.email, name: data.name ?? null, image: data.image ?? null, emailVerified: data.emailVerified ?? null };
  },
  async getUser(id) {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user || !user.email) return null;
    return { id: user.id, email: user.email, name: user.name, image: user.image, emailVerified: user.emailVerified };
  },
  async getUserByEmail(email) {
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user || !user.email) return null;
    return { id: user.id, email: user.email, name: user.name, image: user.image, emailVerified: user.emailVerified };
  },
  async getUserByAccount({ provider, providerAccountId }) {
    const account = await db.query.accounts.findFirst({
      where: and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)),
    });
    if (!account) return null;
    const user = await db.query.users.findFirst({ where: eq(users.id, account.userId) });
    if (!user || !user.email) return null;
    return { id: user.id, email: user.email, name: user.name, image: user.image, emailVerified: user.emailVerified };
  },
  async linkAccount(data) {
    await db.insert(accounts).values({
      userId: data.userId,
      type: data.type,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      refresh_token: data.refresh_token ?? null,
      access_token: data.access_token ?? null,
      expires_at: data.expires_at ?? null,
      token_type: data.token_type ?? null,
      scope: data.scope ?? null,
      id_token: data.id_token ?? null,
      session_state: typeof data.session_state === "string" ? data.session_state : null,
    });
  },
  async createSession(data) {
    await db.insert(sessions).values({
      sessionToken: data.sessionToken,
      userId: data.userId,
      expires: data.expires,
    });
    return { sessionToken: data.sessionToken, userId: data.userId, expires: data.expires };
  },
  async getSessionAndUser(sessionToken) {
    const session = await db.query.sessions.findFirst({ where: eq(sessions.sessionToken, sessionToken) });
    if (!session) return null;
    const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
    if (!user || !user.email) return null;
    return {
      session: { sessionToken: session.sessionToken, userId: session.userId, expires: session.expires! },
      user: { id: user.id, email: user.email, name: user.name, image: user.image, emailVerified: user.emailVerified },
    };
  },
  async updateSession(data) {
    if (data.expires) {
      await db.update(sessions).set({ expires: data.expires }).where(eq(sessions.sessionToken, data.sessionToken));
    }
    const session = await db.query.sessions.findFirst({ where: eq(sessions.sessionToken, data.sessionToken) });
    if (!session) return null;
    return { sessionToken: session.sessionToken, userId: session.userId, expires: session.expires! };
  },
  async deleteSession(sessionToken) {
    await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
  },
  async updateUser(data) {
    if (!data.id) throw new Error("User id required");
    await db.update(users).set({
      name: data.name ?? undefined,
      email: data.email ?? undefined,
      image: data.image ?? undefined,
      emailVerified: data.emailVerified ?? undefined,
    }).where(eq(users.id, data.id));
    const user = await db.query.users.findFirst({ where: eq(users.id, data.id) });
    if (!user || !user.email) throw new Error("User not found");
    return { id: user.id, email: user.email, name: user.name, image: user.image, emailVerified: user.emailVerified };
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter,
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
