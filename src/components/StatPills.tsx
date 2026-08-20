type Stats = {
  total: number;
  routes: number;
  trips: number;
  moving: number;
  stopped: number;
};

const items = (s: Stats) => [
  {
    label: "Live buses",
    value: s.total,
    accent: "from-indigo-500/20 to-indigo-500/0 text-indigo-200",
    icon: "🚍",
  },
  {
    label: "Active routes",
    value: s.routes,
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-200",
    icon: "🛣",
  },
  {
    label: "Active trips",
    value: s.trips,
    accent: "from-amber-500/20 to-amber-500/0 text-amber-200",
    icon: "🧭",
  },
  {
    label: "Moving",
    value: s.moving,
    accent: "from-sky-500/20 to-sky-500/0 text-sky-200",
    icon: "➡",
  },
  {
    label: "Stopped / idle",
    value: s.stopped,
    accent: "from-rose-500/20 to-rose-500/0 text-rose-200",
    icon: "⏸",
  },
];

export default function StatPills({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items(stats).map((it) => (
        <div
          key={it.label}
          className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${it.accent} p-4 shadow shadow-black/20`}
        >
          <div className="text-2xl">{it.icon}</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-white">
            {it.value.toLocaleString()}
          </div>
          <div className="text-xs uppercase tracking-wider text-slate-300">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}
