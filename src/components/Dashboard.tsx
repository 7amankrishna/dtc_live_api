"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Vehicle, VehiclesApiResponse } from "@/lib/types";
import StatPills from "./StatPills";
import VehicleTable from "./VehicleTable";
import StaticDataPanel from "./StaticDataPanel";
import FeedLogsPanel from "./FeedLogsPanel";
import StatusBar from "./StatusBar";

// Leaflet must only be loaded in the browser.
const VehicleMap = dynamic(() => import("./VehicleMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-slate-400 text-sm">
      Loading map…
    </div>
  ),
});

const REFRESH_MS = 15_000;

type Tab = "live" | "static" | "logs";

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("live");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [source, setSource] = useState<"api" | "cache" | "error">("api");
  const [message, setMessage] = useState<string | null>(null);
  const [feedTimestamp, setFeedTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchVehicles = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch("/api/vehicles", { cache: "no-store" });
      const data = (await res.json()) as VehiclesApiResponse;
      setVehicles(data.vehicles || []);
      setSource(data.source);
      setMessage(data.message ?? null);
      setFeedTimestamp(data.timestamp ?? null);
      setLastFetch(new Date());
    } catch (err) {
      setSource("error");
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchVehicles(true);
  }, [fetchVehicles]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void fetchVehicles();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchVehicles]);

  const stats = useMemo(() => {
    const total = vehicles.length;
    const routes = new Set<string>();
    const trips = new Set<string>();
    const moving = vehicles.filter(
      (v) => typeof v.speed === "number" && v.speed > 0
    );
    const stopped = vehicles.filter(
      (v) => v.currentStatus === "STOPPED_AT" || (v.speed ?? 0) === 0
    );
    for (const v of vehicles) {
      if (v.routeId) routes.add(v.routeId);
      if (v.tripId) trips.add(v.tripId);
    }
    return {
      total,
      routes: routes.size,
      trips: trips.size,
      moving: moving.length,
      stopped: stopped.length,
    };
  }, [vehicles]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-4 py-4 lg:px-6">
      <Header
        source={source}
        lastFetch={lastFetch}
        feedTimestamp={feedTimestamp}
        autoRefresh={autoRefresh}
        onToggleAuto={() => setAutoRefresh((v) => !v)}
        onRefresh={() => void fetchVehicles()}
        loading={loading}
      />
      {message && <StatusBar source={source} message={message} />}

      <div className="flex flex-wrap items-center gap-2">
        <TabButton active={tab === "live"} onClick={() => setTab("live")}>
          🚍 Live Vehicles
        </TabButton>
        <TabButton
          active={tab === "static"}
          onClick={() => setTab("static")}
        >
          🗂 Static GTFS Data
        </TabButton>
        <TabButton active={tab === "logs"} onClick={() => setTab("logs")}>
          📜 Feed Logs
        </TabButton>
        <div className="ml-auto text-xs text-slate-400">
          Auto-refresh every {REFRESH_MS / 1000}s
        </div>
      </div>

      {tab === "live" && (
        <>
          <StatPills stats={stats} />
          <div className="grid flex-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl shadow-black/30 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-sm">
                <h2 className="font-semibold text-slate-100">
                  Live Vehicle Map
                </h2>
                <span className="text-xs text-slate-400">
                  {vehicles.length} buses plotted
                </span>
              </div>
              <div className="h-[520px] w-full">
                <VehicleMap vehicles={vehicles} />
              </div>
            </section>
            <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl shadow-black/30 backdrop-blur">
              <div className="border-b border-white/10 px-4 py-2 text-sm font-semibold text-slate-100">
                Vehicle Stream
              </div>
              <VehicleTable vehicles={vehicles} />
            </section>
          </div>
        </>
      )}

      {tab === "static" && <StaticDataPanel />}

      {tab === "logs" && <FeedLogsPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-4 py-1.5 text-sm transition " +
        (active
          ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100 shadow shadow-indigo-900/40"
          : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/30 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

function Header({
  source,
  lastFetch,
  feedTimestamp,
  autoRefresh,
  onToggleAuto,
  onRefresh,
  loading,
}: {
  source: "api" | "cache" | "error";
  lastFetch: Date | null;
  feedTimestamp: string | null;
  autoRefresh: boolean;
  onToggleAuto: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/60 p-5 shadow-2xl shadow-black/40 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-xl shadow-lg">
            🚌
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Delhi Open Transit — Live Dashboard
            </h1>
            <p className="text-sm text-slate-300">
              Real-time and static GTFS data from{" "}
              <a
                className="text-indigo-300 underline-offset-2 hover:underline"
                href="https://otd.delhi.gov.in"
                target="_blank"
                rel="noreferrer"
              >
                otd.delhi.gov.in
              </a>
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SourcePill source={source} />
        <span className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-slate-300">
          Fetched:{" "}
          <span className="text-slate-100">
            {lastFetch ? lastFetch.toLocaleTimeString() : "—"}
          </span>
        </span>
        <span className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-slate-300">
          Feed:{" "}
          <span className="text-slate-100">
            {feedTimestamp
              ? new Date(feedTimestamp).toLocaleTimeString()
              : "—"}
          </span>
        </span>
        <button
          onClick={onToggleAuto}
          className={
            "rounded-full border px-3 py-1 transition " +
            (autoRefresh
              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
              : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/30")
          }
        >
          {autoRefresh ? "⏸ Pause auto-refresh" : "▶ Resume auto-refresh"}
        </button>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-full border border-indigo-400/40 bg-indigo-500/20 px-3 py-1 text-indigo-100 transition hover:bg-indigo-500/30 disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "↻ Refresh now"}
        </button>
      </div>
    </header>
  );
}

function SourcePill({ source }: { source: "api" | "cache" | "error" }) {
  const map = {
    api: {
      label: "LIVE • OTD API",
      cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
      dot: "bg-emerald-400",
    },
    cache: {
      label: "CACHED SNAPSHOT",
      cls: "border-amber-400/40 bg-amber-500/15 text-amber-200",
      dot: "bg-amber-400",
    },
    error: {
      label: "API ERROR",
      cls: "border-rose-400/40 bg-rose-500/15 text-rose-200",
      dot: "bg-rose-400",
    },
  } as const;
  const cfg = map[source];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${cfg.cls}`}
    >
      <span className={`h-2 w-2 rounded-full ${cfg.dot} animate-pulse`} />
      {cfg.label}
    </span>
  );
}
