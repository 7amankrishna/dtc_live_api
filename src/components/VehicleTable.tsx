"use client";

import { useMemo, useState } from "react";
import type { Vehicle } from "@/lib/types";

type SortKey = "vehicleId" | "routeId" | "speed" | "timestamp";

export default function VehicleTable({ vehicles }: { vehicles: Vehicle[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? vehicles.filter(
          (v) =>
            v.vehicleId.toLowerCase().includes(q) ||
            (v.routeId?.toLowerCase().includes(q) ?? false) ||
            (v.tripId?.toLowerCase().includes(q) ?? false) ||
            (v.stopId?.toLowerCase().includes(q) ?? false)
        )
      : vehicles;
    const sorted = [...base].sort((a, b) => {
      const av = (a[sortKey] ?? "") as string | number;
      const bv = (b[sortKey] ?? "") as string | number;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return sorted;
  }, [vehicles, query, sortKey, sortDir]);

  const headers: { key: SortKey; label: string }[] = [
    { key: "vehicleId", label: "Vehicle" },
    { key: "routeId", label: "Route" },
    { key: "speed", label: "Speed" },
    { key: "timestamp", label: "Updated" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by vehicle / route / trip / stop…"
          className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <span className="whitespace-nowrap text-xs text-slate-400">
          {filtered.length} / {vehicles.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-900/95 text-slate-400">
            <tr>
              <th className="w-28 px-3 py-2 font-medium">Vehicle</th>
              <th className="w-20 px-3 py-2 font-medium">Route</th>
              <th className="w-28 px-3 py-2 font-medium">Trip</th>
              <th className="w-20 px-3 py-2 font-medium text-right">Speed</th>
              <th className="w-24 px-3 py-2 font-medium">Status</th>
              <th className="w-28 px-3 py-2 font-medium">Stop</th>
              <th className="w-20 px-3 py-2 font-medium text-right">Lat</th>
              <th className="w-20 px-3 py-2 font-medium text-right">Lon</th>
              <th className="w-24 px-3 py-2 font-medium text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-12 text-center text-slate-500"
                >
                  No vehicles match the current filter.
                </td>
              </tr>
            )}
            {filtered.slice(0, 300).map((v) => (
              <tr
                key={`${v.vehicleId}-${v.timestamp}`}
                className="border-b border-white/5 hover:bg-white/5"
              >
                <td className="truncate px-3 py-1.5 font-mono text-[11px] text-slate-200">
                  {v.vehicleId}
                </td>
                <td className="truncate px-3 py-1.5 text-slate-200">
                  {v.routeId || "—"}
                </td>
                <td className="truncate px-3 py-1.5 text-slate-400">
                  {v.tripId || "—"}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-200">
                  {typeof v.speed === "number" ? `${v.speed.toFixed(1)}` : "—"}
                </td>
                <td className="px-3 py-1.5">
                  <StatusBadge status={v.currentStatus} />
                </td>
                <td className="truncate px-3 py-1.5 text-slate-400">
                  {v.stopId || "—"}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">
                  {v.latitude.toFixed(5)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">
                  {v.longitude.toFixed(5)}
                </td>
                <td className="px-3 py-1.5 text-right text-slate-400">
                  {timeAgo(v.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/5 px-3 py-1.5 text-right text-[11px] text-slate-500">
        Showing top {Math.min(300, filtered.length)} of {filtered.length}
      </div>
      {/* Hidden but functional sort controls for accessibility */}
      <div className="sr-only">
        {headers.map((h) => (
          <button
            key={h.key}
            onClick={() => {
              if (sortKey === h.key) {
                setSortDir(sortDir === "asc" ? "desc" : "asc");
              } else {
                setSortKey(h.key);
                setSortDir("asc");
              }
            }}
          >
            sort by {h.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status)
    return <span className="text-slate-500">—</span>;
  const map: Record<string, string> = {
    INCOMING_AT: "bg-amber-500/20 text-amber-200",
    STOPPED_AT: "bg-rose-500/20 text-rose-200",
    IN_TRANSIT_TO: "bg-emerald-500/20 text-emerald-200",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        map[status] ?? "bg-slate-500/20 text-slate-200"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
