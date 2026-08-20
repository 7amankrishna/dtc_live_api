import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Static GTFS data - Stops
export const stops = pgTable(
  "stops",
  {
    id: serial("id").primaryKey(),
    stopId: text("stop_id").notNull(),
    stopName: text("stop_name").notNull(),
    stopLat: doublePrecision("stop_lat").notNull(),
    stopLon: doublePrecision("stop_lon").notNull(),
  },
  (t) => ({
    stopIdIdx: uniqueIndex("stops_stop_id_idx").on(t.stopId),
    nameIdx: index("stops_name_idx").on(t.stopName),
  })
);

// Static GTFS data - Routes
export const routes = pgTable(
  "routes",
  {
    id: serial("id").primaryKey(),
    routeId: text("route_id").notNull(),
    routeShortName: text("route_short_name"),
    routeLongName: text("route_long_name"),
    routeType: integer("route_type"),
  },
  (t) => ({
    routeIdIdx: uniqueIndex("routes_route_id_idx").on(t.routeId),
  })
);

// Static GTFS data - Trips
export const trips = pgTable(
  "trips",
  {
    id: serial("id").primaryKey(),
    tripId: text("trip_id").notNull(),
    routeId: text("route_id").notNull(),
    serviceId: text("service_id"),
    tripHeadsign: text("trip_headsign"),
    directionId: integer("direction_id"),
  },
  (t) => ({
    tripIdIdx: uniqueIndex("trips_trip_id_idx").on(t.tripId),
    routeIdx: index("trips_route_idx").on(t.routeId),
  })
);

// Static GTFS data - Stop Times
export const stopTimes = pgTable(
  "stop_times",
  {
    id: serial("id").primaryKey(),
    tripId: text("trip_id").notNull(),
    arrivalTime: text("arrival_time"),
    departureTime: text("departure_time"),
    stopId: text("stop_id").notNull(),
    stopSequence: integer("stop_sequence").notNull(),
  },
  (t) => ({
    tripIdx: index("stop_times_trip_idx").on(t.tripId),
    stopIdx: index("stop_times_stop_idx").on(t.stopId),
  })
);

// Real-time vehicle positions (latest snapshot)
export const vehiclePositions = pgTable(
  "vehicle_positions",
  {
    id: serial("id").primaryKey(),
    vehicleId: text("vehicle_id").notNull(),
    tripId: text("trip_id"),
    routeId: text("route_id"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    bearing: doublePrecision("bearing"),
    speed: doublePrecision("speed"),
    currentStopSequence: integer("current_stop_sequence"),
    stopId: text("stop_id"),
    currentStatus: text("current_status"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    vehicleIdx: index("vp_vehicle_idx").on(t.vehicleId),
    routeIdx: index("vp_route_idx").on(t.routeId),
    fetchedAtIdx: index("vp_fetched_at_idx").on(t.fetchedAt),
  })
);

// Log of feed fetches for monitoring
export const feedLogs = pgTable("feed_logs", {
  id: serial("id").primaryKey(),
  feedType: text("feed_type").notNull(),
  status: text("status").notNull(),
  entityCount: integer("entity_count").default(0),
  message: text("message"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
