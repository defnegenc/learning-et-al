import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { getAuthUser } from "@/lib/get-user";
import { addHomework, listHomework, retireHomework } from "@/lib/librarian/homework";

export async function GET(req: NextRequest) {
  await ensureSchema();
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const homework = await listHomework(userId);
  return NextResponse.json({
    homework: homework.map(h => ({ id: h.id, topic: h.keyword, createdAt: h.createdAt })),
  });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { topic } = await req.json();
    if (typeof topic !== "string") return NextResponse.json({ error: "Missing topic" }, { status: 400 });
    const result = await addHomework(userId, topic);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ homework: { id: result.homework.id, topic: result.homework.keyword } });
  } catch (error) {
    console.error("Homework create error:", error);
    return NextResponse.json({ error: "Failed to assign homework" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const userId = await getAuthUser(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json();
    if (typeof id !== "string") return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await retireHomework(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Homework retire error:", error);
    return NextResponse.json({ error: "Failed to retire homework" }, { status: 500 });
  }
}
