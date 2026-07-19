import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, digests, events, interests, papers } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getAuthUser } from "@/lib/get-user";

const ADMIN_ID = process.env.ADMIN_USER_ID || "";

export async function GET(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId || userId !== ADMIN_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // All users
    const allUsers = await db.select().from(users);

    // Per-user stats
    const userStats = await Promise.all(
      allUsers.map(async (u) => {
        const userDigests = await db.select().from(digests).where(eq(digests.userId, u.id));
        const userEvents = await db.select().from(events).where(eq(events.userId, u.id));
        const userInterests = await db.select().from(interests).where(eq(interests.userId, u.id));

        const starredCount = userDigests.filter(d => d.starred).length;
        const digDeepCount = userEvents.filter(e => e.type === "dig_deeper").length;
        const regenerateCount = userEvents.filter(e => e.type === "digest_generate" && e.metadata?.includes('"force":true')).length;
        const lastEvent = userEvents.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0];

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          digestPaused: !!u.digestPaused,
          createdAt: u.createdAt,
          lastActive: lastEvent?.createdAt || u.createdAt,
          digestCount: userDigests.length,
          starredCount,
          digDeepCount,
          regenerateCount,
          interestCount: userInterests.length,
          interests: userInterests.map(i => i.keyword).slice(0, 10),
        };
      })
    );

    // Recent events (activity feed)
    const recentEvents = await db.select().from(events).orderBy(desc(events.createdAt)).limit(50);
    const eventFeed = await Promise.all(
      recentEvents.map(async (e) => {
        const user = allUsers.find(u => u.id === e.userId);
        let digestTheme = "";
        if (e.digestId) {
          const d = await db.query.digests.findFirst({ where: eq(digests.id, e.digestId) });
          digestTheme = d?.theme || "";
        }
        return {
          ...e,
          metadata: e.metadata ? JSON.parse(e.metadata) : null,
          userName: user?.name || user?.email || "Unknown",
          digestTheme,
        };
      })
    );

    // All themes
    const allDigests = await db.select().from(digests).orderBy(desc(digests.createdAt)).limit(100);
    const themes = allDigests.map(d => {
      const user = allUsers.find(u => u.id === d.userId);
      return {
        id: d.id,
        theme: d.theme,
        date: d.date,
        starred: d.starred,
        userName: user?.name || user?.email || "Unknown",
        userId: d.userId,
      };
    });

    return NextResponse.json({
      users: userStats,
      events: eventFeed,
      themes,
      totals: {
        users: allUsers.length,
        digests: allDigests.length,
        events: recentEvents.length,
        starred: allDigests.filter(d => d.starred).length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Pause/resume automatic digest generation for a user. The cron skips paused users.
export async function PATCH(req: NextRequest) {
  const userId = await getAuthUser(req);
  if (!userId || userId !== ADMIN_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const targetId = typeof body.userId === "string" ? body.userId : "";
    if (!targetId || typeof body.digestPaused !== "boolean") {
      return NextResponse.json({ error: "userId and digestPaused required" }, { status: 400 });
    }
    const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await db.update(users).set({ digestPaused: body.digestPaused }).where(eq(users.id, targetId));
    return NextResponse.json({ ok: true, userId: targetId, digestPaused: body.digestPaused });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
