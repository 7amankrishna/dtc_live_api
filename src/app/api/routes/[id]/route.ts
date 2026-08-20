import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  routes as routesTable,
  stops as stopsTable,
  trips as tripsTable,
  stopTimes as stopTimesTable,
} from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const routeRows = await db
    .select()
    .from(routesTable)
    .where(eq(routesTable.routeId, id))
    .limit(1);
  if (routeRows.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Route not found" },
      { status: 404 }
    );
  }
  const route = routeRows[0];
  const routeTrips = await db
    .select({ id: tripsTable.tripId, headsign: tripsTable.tripHeadsign })
    .from(tripsTable)
    .where(eq(tripsTable.routeId, id))
    .limit(20);

  // Build ordered stop list from the first trip on the route.
  let orderedStops: Array<{
    stopId: string;
    stopName: string;
    stopLat: number;
    stopLon: number;
    stopSequence: number;
    arrivalTime: string | null;
  }> = [];
  if (routeTrips[0]) {
    const tripId = routeTrips[0].id;
    const rows = await db
      .select({
        stopId: stopTimesTable.stopId,
        stopSequence: stopTimesTable.stopSequence,
        arrivalTime: stopTimesTable.arrivalTime,
        stopName: stopsTable.stopName,
        stopLat: stopsTable.stopLat,
        stopLon: stopsTable.stopLon,
      })
      .from(stopTimesTable)
      .leftJoin(stopsTable, eq(stopsTable.stopId, stopTimesTable.stopId))
      .where(eq(stopTimesTable.tripId, tripId))
      .orderBy(stopTimesTable.stopSequence)
      .limit(200);
    orderedStops = rows
      .filter((r) => r.stopName)
      .map((r) => ({
        stopId: r.stopId,
        stopName: r.stopName as string,
        stopLat: r.stopLat as number,
        stopLon: r.stopLon as number,
        stopSequence: r.stopSequence,
        arrivalTime: r.arrivalTime,
      }));
  }

  const tripCountRow = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(tripsTable)
    .where(eq(tripsTable.routeId, id));
  const tripCount = tripCountRow[0]?.value ?? 0;

  return NextResponse.json({
    ok: true,
    route,
    tripCount,
    sampleTrips: routeTrips,
    stops: orderedStops,
  });
}
