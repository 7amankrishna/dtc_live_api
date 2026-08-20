"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedLogRow } from "@/lib/types";

export default function FeedLogsPanel() {
  const [logs, setLogs] = useState<FeedLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feed/logs", { cache: "no-store" });
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
    const id = window.setInterval(fetchLogs, 20_000);
    return () => window.clearInterval(id);
  }, [fetchLogs]);

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow shadow-black/30">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">
          Recent OTD feed activity
        </h2>
        <button
          onClick={() => void fetchLogs()}
          className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs text-slate-300 hover:border-white/30"
        >
          ↻ Refresh
        </button>
      </div>
      {error && (
        <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-white/5">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900/95 text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Feed</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Entities</th>
              <th className="px-3 py-2 font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-12 text-center text-slate-500"
                >
                  No feed activity yet. Trigger a refresh from the Live tab.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-white/5">
                <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">
                  {new Date(l.fetchedAt).toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-slate-200">{l.feedType}</td>
                <td className="px-3 py-1.5">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                      (l.status === "ok"
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-rose-500/20 text-rose-200")
                    }
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-200">
                  {l.entityCount ?? 0}
                </td>
                <td className="px-3 py-1.5 text-slate-400">{l.message || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
