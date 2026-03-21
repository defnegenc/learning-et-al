import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions } from "@/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions } as any);

export const { handlers, auth, signIn, signOut } = NextAuth({
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
