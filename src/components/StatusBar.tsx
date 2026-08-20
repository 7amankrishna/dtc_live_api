export default function StatusBar({
  source,
  message,
}: {
  source: "api" | "cache" | "error";
  message: string;
}) {
  const cls =
    source === "error"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
      : source === "cache"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  return (
    <div
      className={`rounded-xl border px-4 py-2 text-xs ${cls}`}
      role="status"
    >
      {message}
    </div>
  );
}
