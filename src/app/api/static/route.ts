import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  routes as routesTable,
  stops as stopsTable,
  stopTimes as stopTimesTable,
  trips as tripsTable,
} from "@/db/schema";
import { sql, ilike, and, eq, desc, count } from "drizzle-orm";
import { syncStaticData } from "@/lib/otd-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tab = "stops" | "routes" | "trips" | "stop_times";

const TAB_SET: Tab[] = ["stops", "routes", "trips", "stop_times"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tabParam = (searchParams.get("tab") || "stops") as Tab;
  const tab: Tab = TAB_SET.includes(tabParam) ? tabParam : "stops";
  const search = (searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const sync = searchParams.get("sync") === "1";

  if (sync) {
    const result = await syncStaticData();
    return NextResponse.json({ ok: true, synced: result });
  }

  const totalRow = await db
    .select({ value: count() })
    .from(
      tab === "stops"
        ? stopsTable
        : tab === "routes"
        ? routesTable
        : tab === "trips"
        ? tripsTable
        : stopTimesTable
    );
  const total = totalRow[0]?.value ?? 0;

  if (tab === "stops") {
    const where = search ? ilike(stopsTable.stopName, `%${search}%`) : undefined;
    const rows = await db
      .select()
      .from(stopsTable)
      .where(where)
      .orderBy(stopsTable.stopName)
      .limit(limit)
      .offset(offset);
    return NextResponse.json({ ok: true, tab, total, rows });
  }
  if (tab === "routes") {
    const where = search
      ? sql`(${routesTable.routeShortName} ILIKE ${`%${search}%`} OR ${routesTable.routeLongName} ILIKE ${`%${search}%`} OR ${routesTable.routeId} ILIKE ${`%${search}%`})`
      : undefined;
    const rows = await db
      .select()
      .from(routesTable)
      .where(where)
      .orderBy(routesTable.routeShortName)
      .limit(limit)
      .offset(offset);
    return NextResponse.json({ ok: true, tab, total, rows });
  }
  if (tab === "trips") {
    const where = search
      ? sql`(${tripsTable.tripId} ILIKE ${`%${search}%`} OR ${tripsTable.routeId} ILIKE ${`%${search}%`} OR ${tripsTable.tripHeadsign} ILIKE ${`%${search}%`})`
      : undefined;
    const rows = await db
      .select()
      .from(tripsTable)
      .where(where)
      .orderBy(tripsTable.tripId)
      .limit(limit)
      .offset(offset);
    return NextResponse.json({ ok: true, tab, total, rows });
  }
  // stop_times
  const where = search
    ? sql`(${stopTimesTable.tripId} ILIKE ${`%${search}%`} OR ${stopTimesTable.stopId} ILIKE ${`%${search}%`})`
    : undefined;
  const rows = await db
    .select()
    .from(stopTimesTable)
    .where(where)
    .orderBy(stopTimesTable.tripId, stopTimesTable.stopSequence)
    .limit(limit)
    .offset(offset);
  return NextResponse.json({ ok: true, tab, total, rows });
}
