"use client";

import { useCallback, useEffect, useState } from "react";
import type { RouteRow, StopRow, StopTimeRow, TripRow } from "@/lib/types";

type Tab = "stops" | "routes" | "trips" | "stop_times";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "stops", label: "Stops", icon: "📍" },
  { key: "routes", label: "Routes", icon: "🛣" },
  { key: "trips", label: "Trips", icon: "🧭" },
  { key: "stop_times", label: "Stop Times", icon: "⏱" },
];

export default function StaticDataPanel() {
  const [tab, setTab] = useState<Tab>("stops");
  const [rows, setRows] = useState<
    StopRow[] | RouteRow[] | TripRow[] | StopTimeRow[]
  >([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/static", window.location.origin);
      url.searchParams.set("tab", tab);
      if (query.trim()) url.searchParams.set("q", query.trim());
      url.searchParams.set("limit", "200");
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Failed to load");
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [tab, query]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/static?sync=1", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error("Sync failed");
      const summary = data.synced as Record<
        string,
        { ok: boolean; count: number; message?: string }
      >;
      const parts = Object.entries(summary).map(
        ([k, v]) => `${k}=${v.ok ? v.count : `error:${v.message ?? "?"}`}`
      );
      setSyncResult(`Synced: ${parts.join(", ")}`);
      void fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [fetchRows]);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow shadow-black/30">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full border border-white/10 bg-slate-950/60 p-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "flex items-center gap-1.5 rounded-full px-3 py-1 transition " +
                (tab === t.key
                  ? "bg-indigo-500/20 text-indigo-100"
                  : "text-slate-300 hover:bg-white/5")
              }
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Filter ${tab}…`}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <button
          onClick={() => void fetchRows()}
          disabled={loading}
          className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-200 hover:border-white/30 disabled:opacity-60"
        >
          {loading ? "Loading…" : "↻ Search"}
        </button>
        <button
          onClick={triggerSync}
          disabled={syncing}
          className="rounded-full border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-60"
        >
          {syncing ? "Syncing from OTD…" : "↓ Sync from otd.delhi.gov.in"}
        </button>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          {total.toLocaleString()} {tab} in database
          {query && rows.length !== total ? ` · ${rows.length} match` : ""}
        </span>
        {syncResult && <span className="text-emerald-300">{syncResult}</span>}
      </div>
      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-white/5">
        {tab === "stops" && <StopsTable rows={rows as StopRow[]} />}
        {tab === "routes" && <RoutesTable rows={rows as RouteRow[]} />}
        {tab === "trips" && <TripsTable rows={rows as TripRow[]} />}
        {tab === "stop_times" && <StopTimesTable rows={rows as StopTimeRow[]} />}
      </div>
    </section>
  );
}

function StopsTable({ rows }: { rows: StopRow[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-slate-900/95 text-slate-400">
        <tr>
          <th className="w-32 px-3 py-2 font-medium">Stop ID</th>
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="w-28 px-3 py-2 font-medium text-right">Lat</th>
          <th className="w-28 px-3 py-2 font-medium text-right">Lon</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="px-3 py-12 text-center text-slate-500">
              No stops. Run “Sync from otd.delhi.gov.in” to populate.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="px-3 py-1.5 font-mono text-[11px] text-slate-300">
              {r.stopId}
            </td>
            <td className="px-3 py-1.5 text-slate-100">{r.stopName}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">
              {r.stopLat.toFixed(5)}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">
              {r.stopLon.toFixed(5)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RoutesTable({ rows }: { rows: RouteRow[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-slate-900/95 text-slate-400">
        <tr>
          <th className="w-28 px-3 py-2 font-medium">Route ID</th>
          <th className="w-28 px-3 py-2 font-medium">Short name</th>
          <th className="px-3 py-2 font-medium">Long name</th>
          <th className="w-20 px-3 py-2 font-medium text-right">Type</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="px-3 py-12 text-center text-slate-500">
              No routes. Run “Sync from otd.delhi.gov.in” to populate.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="px-3 py-1.5 font-mono text-[11px] text-slate-300">
              {r.routeId}
            </td>
            <td className="px-3 py-1.5 text-slate-100">
              {r.routeShortName || "—"}
            </td>
            <td className="px-3 py-1.5 text-slate-300">
              {r.routeLongName || "—"}
            </td>
            <td className="px-3 py-1.5 text-right text-slate-400">
              {r.routeType ?? "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TripsTable({ rows }: { rows: TripRow[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-slate-900/95 text-slate-400">
        <tr>
          <th className="w-32 px-3 py-2 font-medium">Trip ID</th>
          <th className="w-24 px-3 py-2 font-medium">Route</th>
          <th className="w-24 px-3 py-2 font-medium">Service</th>
          <th className="w-16 px-3 py-2 font-medium text-right">Dir</th>
          <th className="px-3 py-2 font-medium">Headsign</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-12 text-center text-slate-500">
              No trips. Run “Sync from otd.delhi.gov.in” to populate.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="px-3 py-1.5 font-mono text-[11px] text-slate-300">
              {r.tripId}
            </td>
            <td className="px-3 py-1.5 text-slate-100">{r.routeId}</td>
            <td className="px-3 py-1.5 text-slate-400">
              {r.serviceId || "—"}
            </td>
            <td className="px-3 py-1.5 text-right text-slate-400">
              {r.directionId ?? "—"}
            </td>
            <td className="px-3 py-1.5 text-slate-300">
              {r.tripHeadsign || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StopTimesTable({ rows }: { rows: StopTimeRow[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-slate-900/95 text-slate-400">
        <tr>
          <th className="w-32 px-3 py-2 font-medium">Trip ID</th>
          <th className="w-16 px-3 py-2 font-medium text-right">Seq</th>
          <th className="w-28 px-3 py-2 font-medium">Arrival</th>
          <th className="w-28 px-3 py-2 font-medium">Departure</th>
          <th className="w-32 px-3 py-2 font-medium">Stop ID</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-12 text-center text-slate-500">
              No stop times. Run “Sync from otd.delhi.gov.in” to populate.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="px-3 py-1.5 font-mono text-[11px] text-slate-300">
              {r.tripId}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">
              {r.stopSequence}
            </td>
            <td className="px-3 py-1.5 text-slate-200">
              {r.arrivalTime || "—"}
            </td>
            <td className="px-3 py-1.5 text-slate-200">
              {r.departureTime || "—"}
            </td>
            <td className="px-3 py-1.5 font-mono text-[11px] text-slate-300">
              {r.stopId}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
