import { NextResponse } from "next/server";
import { db } from "@/db";
import { feedLogs } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const rows = await db
    .select()
    .from(feedLogs)
    .orderBy(desc(feedLogs.fetchedAt))
    .limit(50);
  return NextResponse.json({ ok: true, logs: rows });
}
