export type Vehicle = {
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

export type VehiclesApiResponse = {
  ok: boolean;
  source: "api" | "cache" | "error";
  message?: string | null;
  count: number;
  timestamp?: string;
  vehicles: Vehicle[];
};

export type StopRow = {
  id: number;
  stopId: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
};

export type RouteRow = {
  id: number;
  routeId: string;
  routeShortName: string | null;
  routeLongName: string | null;
  routeType: number | null;
};

export type TripRow = {
  id: number;
  tripId: string;
  routeId: string;
  serviceId: string | null;
  tripHeadsign: string | null;
  directionId: number | null;
};

export type StopTimeRow = {
  id: number;
  tripId: string;
  arrivalTime: string | null;
  departureTime: string | null;
  stopId: string;
  stopSequence: number;
};

export type FeedLogRow = {
  id: number;
  feedType: string;
  status: string;
  entityCount: number | null;
  message: string | null;
  fetchedAt: string;
};
