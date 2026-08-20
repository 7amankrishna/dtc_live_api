import { NextResponse } from "next/server";
import { db } from "@/db";
import { stops as stopsTable, stopTimes as stopTimesTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const stopRows = await db
    .select()
    .from(stopsTable)
    .where(eq(stopsTable.stopId, id))
    .limit(1);
  if (stopRows.length === 0) {
    return NextResponse.json({ ok: false, message: "Stop not found" }, { status: 404 });
  }
  const stop = stopRows[0];
  const times = await db
    .select({
      tripId: stopTimesTable.tripId,
      arrivalTime: stopTimesTable.arrivalTime,
      departureTime: stopTimesTable.departureTime,
      stopSequence: stopTimesTable.stopSequence,
    })
    .from(stopTimesTable)
    .where(eq(stopTimesTable.stopId, id))
    .orderBy(stopTimesTable.arrivalTime)
    .limit(200);
  return NextResponse.json({ ok: true, stop, times });
}
