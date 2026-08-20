import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { db } from "@/db";
import {
  feedLogs,
  routes as routesTable,
  stops as stopsTable,
  stopTimes as stopTimesTable,
  trips as tripsTable,
  vehiclePositions,
} from "@/db/schema";
import { sql } from "drizzle-orm";

const OTD_BASE = "https://otd.delhi.gov.in";

export type FetchResult<T> = {
  ok: boolean;
  data: T;
  source: "api" | "cache" | "error";
  message?: string;
  count?: number;
  timestamp?: string;
};

function getApiKey(): string {
  const key = process.env.OTD_API_KEY;
  if (!key) throw new Error("OTD_API_KEY environment variable is not set");
  return key;
}

async function fetchProtobuf(
  path: string,
  feedType: string
): Promise<GtfsRealtimeBindings.transit_realtime.FeedMessage | null> {
  const key = getApiKey();
  const url = `${OTD_BASE}${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      // Disable Next.js cache - we want fresh real-time data
      cache: "no-store",
      headers: { "User-Agent": "Delhi-OTD-Dashboard/1.0" },
    });
    if (!res.ok) {
      const msg = `OTD ${feedType} responded ${res.status}`;
      await db.insert(feedLogs).values({
        feedType,
        status: "error",
        message: msg,
      });
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      buffer
    );
    return feed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.insert(feedLogs).values({
      feedType,
      status: "error",
      message: msg,
    });
    return null;
  }
}

export type VehicleSnapshot = {
  vehicleId: string;
  tripId?: string;
  routeId?: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  currentStopSequence?: number;
  stopId?: string;
  currentStatus?: string;
  timestamp: string;
};

function toLongNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return v;
  // protobufjs Long objects have low/high/unsigned
  if (typeof v === "object") {
    const obj = v as { low?: number; high?: number; unsigned?: boolean };
    if (typeof obj.low === "number" && typeof obj.high === "number") {
      const sign = obj.unsigned ? 1 : 1;
      return obj.low + obj.high * 0x100000000 * sign;
    }
  }
  if (typeof v === "string") return Number(v);
  return undefined;
}

export function parseVehicleFeed(
  feed: GtfsRealtimeBindings.transit_realtime.FeedMessage
): VehicleSnapshot[] {
  const snapshots: VehicleSnapshot[] = [];
  for (const entity of feed.entity) {
    if (!entity.vehicle) continue;
    const v = entity.vehicle;
    const pos = v.position;
    if (!pos) continue;
    const lat = toLongNumber(pos.latitude as unknown);
    const lon = toLongNumber(pos.longitude as unknown);
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (lat === 0 && lon === 0) continue;

    const bearing = toLongNumber(pos.bearing as unknown);
    const speed = toLongNumber(pos.speed as unknown);
    const ts = toLongNumber(v.timestamp as unknown);
    const trip = v.trip;

    const statusMap: Record<number, string> = {
      0: "INCOMING_AT",
      1: "STOPPED_AT",
      2: "IN_TRANSIT_TO",
    };
    const statusNum = toLongNumber(v.currentStatus as unknown);
    const currentStatus =
      typeof statusNum === "number" ? statusMap[statusNum] : undefined;

    snapshots.push({
      vehicleId: entity.id || `veh-${lat.toFixed(4)}-${lon.toFixed(4)}`,
      tripId: trip?.tripId ?? undefined,
      routeId: trip?.routeId ?? undefined,
      latitude: lat,
      longitude: lon,
      bearing: typeof bearing === "number" ? bearing : undefined,
      speed: typeof speed === "number" ? speed : undefined,
      currentStopSequence:
        typeof toLongNumber(v.currentStopSequence as unknown) === "number"
          ? (toLongNumber(v.currentStopSequence as unknown) as number)
          : undefined,
      stopId: v.stopId ?? undefined,
      currentStatus,
      timestamp:
        typeof ts === "number" ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
    });
  }
  return snapshots;
}

/**
 * Fetches the latest VehiclePositions feed from the OTD API and stores a
 * snapshot of every live bus in the database. Returns the in-memory snapshot
 * so the caller can render it without a second query.
 */
export async function fetchAndStoreVehiclePositions(): Promise<FetchResult<VehicleSnapshot[]>> {
  const feed = await fetchProtobuf(
    "/api/realtime/VehiclePositions.pb",
    "VehiclePositions"
  );
  if (!feed) {
    // Return last snapshot from the database as a fallback.
    const cached = await db
      .select()
      .from(vehiclePositions)
      .orderBy(sql`${vehiclePositions.fetchedAt} DESC`)
      .limit(500);
    return {
      ok: false,
      data: cached.map((r) => ({
        vehicleId: r.vehicleId,
        tripId: r.tripId ?? undefined,
        routeId: r.routeId ?? undefined,
        latitude: r.latitude,
        longitude: r.longitude,
        bearing: r.bearing ?? undefined,
        speed: r.speed ?? undefined,
        currentStopSequence: r.currentStopSequence ?? undefined,
        stopId: r.stopId ?? undefined,
        currentStatus: r.currentStatus ?? undefined,
        timestamp: r.timestamp.toISOString(),
      })),
      source: "cache",
      message: "Live feed unavailable. Showing most recent cached snapshot.",
      count: cached.length,
    };
  }
  const snapshots = parseVehicleFeed(feed);
  // Replace the in-memory snapshot: delete previous rows and insert new ones.
  await db.delete(vehiclePositions);
  if (snapshots.length > 0) {
    // Insert in batches to stay below Postgres parameter limits.
    const BATCH = 500;
    for (let i = 0; i < snapshots.length; i += BATCH) {
      const batch = snapshots.slice(i, i + BATCH);
      await db.insert(vehiclePositions).values(
        batch.map((s) => ({
          vehicleId: s.vehicleId,
          tripId: s.tripId,
          routeId: s.routeId,
          latitude: s.latitude,
          longitude: s.longitude,
          bearing: s.bearing,
          speed: s.speed,
          currentStopSequence: s.currentStopSequence,
          stopId: s.stopId,
          currentStatus: s.currentStatus,
          timestamp: new Date(s.timestamp),
        }))
      );
    }
  }
  await db.insert(feedLogs).values({
    feedType: "VehiclePositions",
    status: "ok",
    entityCount: snapshots.length,
    message: `Parsed ${snapshots.length} live vehicles`,
  });
  const headerTs = toLongNumber(feed.header?.timestamp as unknown);
  return {
    ok: true,
    data: snapshots,
    source: "api",
    count: snapshots.length,
    timestamp:
      typeof headerTs === "number"
        ? new Date(headerTs * 1000).toISOString()
        : new Date().toISOString(),
  };
}

// -------- Static GTFS data -------------------------------------------------

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

async function fetchAndStoreStaticFile<T extends Record<string, unknown>>(
  path: string,
  feedType: string,
  store: (rows: CsvRow[]) => Promise<void>,
  mapRow: (row: CsvRow) => T
): Promise<{ ok: boolean; count: number; message?: string }> {
  try {
    const res = await fetch(`${OTD_BASE}${path}`, {
      cache: "no-store",
      headers: { "User-Agent": "Delhi-OTD-Dashboard/1.0" },
    });
    if (!res.ok) {
      const msg = `${feedType} responded ${res.status}`;
      await db.insert(feedLogs).values({
        feedType,
        status: "error",
        message: msg,
      });
      return { ok: false, count: 0, message: msg };
    }
    const text = await res.text();
    const rows = parseCsv(text);
    await store(rows);
    await db.insert(feedLogs).values({
      feedType,
      status: "ok",
      entityCount: rows.length,
      message: `Loaded ${rows.length} rows from ${path}`,
    });
    return { ok: true, count: rows.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.insert(feedLogs).values({
      feedType,
      status: "error",
      message: msg,
    });
    return { ok: false, count: 0, message: msg };
  }
}

/**
 * Syncs the public GTFS static data (stops, routes, trips, stop_times) from
 * the OTD portal. These endpoints are public and do not require an API key.
 */
export async function syncStaticData(): Promise<{
  stops: { ok: boolean; count: number; message?: string };
  routes: { ok: boolean; count: number; message?: string };
  trips: { ok: boolean; count: number; message?: string };
  stopTimes: { ok: boolean; count: number; message?: string };
}> {
  const [stopsRes, routesRes, tripsRes, stopTimesRes] = await Promise.all([
    fetchAndStoreStaticFile(
      "/data/static/stops/stops.txt",
      "stops",
      async (rows) => {
        if (rows.length === 0) return;
        await db.delete(stopsTable);
        const BATCH = 1000;
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          await db.insert(stopsTable).values(
            batch.map((r) => ({
              stopId: r.stop_id,
              stopName: r.stop_name,
              stopLat: Number(r.stop_lat),
              stopLon: Number(r.stop_lon),
            }))
          );
        }
      },
      () => ({})
    ),
    fetchAndStoreStaticFile(
      "/data/static/routes/routes.txt",
      "routes",
      async (rows) => {
        if (rows.length === 0) return;
        await db.delete(routesTable);
        const BATCH = 1000;
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          await db.insert(routesTable).values(
            batch.map((r) => ({
              routeId: r.route_id,
              routeShortName: r.route_short_name,
              routeLongName: r.route_long_name,
              routeType: r.route_type ? Number(r.route_type) : null,
            }))
          );
        }
      },
      () => ({})
    ),
    fetchAndStoreStaticFile(
      "/data/static/trips/trips.txt",
      "trips",
      async (rows) => {
        if (rows.length === 0) return;
        await db.delete(tripsTable);
        const BATCH = 1000;
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          await db.insert(tripsTable).values(
            batch.map((r) => ({
              tripId: r.trip_id,
              routeId: r.route_id,
              serviceId: r.service_id,
              tripHeadsign: r.trip_headsign,
              directionId: r.direction_id ? Number(r.direction_id) : null,
            }))
          );
        }
      },
      () => ({})
    ),
    fetchAndStoreStaticFile(
      "/data/static/stop_times/stop_times.txt",
      "stop_times",
      async (rows) => {
        if (rows.length === 0) return;
        await db.delete(stopTimesTable);
        const BATCH = 1000;
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          await db.insert(stopTimesTable).values(
            batch.map((r) => ({
              tripId: r.trip_id,
              arrivalTime: r.arrival_time,
              departureTime: r.departure_time,
              stopId: r.stop_id,
              stopSequence: Number(r.stop_sequence),
            }))
          );
        }
      },
      () => ({})
    ),
  ]);
  return {
    stops: stopsRes,
    routes: routesRes,
    trips: tripsRes,
    stopTimes: stopTimesRes,
  };
}
