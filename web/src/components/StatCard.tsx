export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-[var(--good)]"
      : tone === "warn"
        ? "text-[var(--warn)]"
        : tone === "bad"
          ? "text-[var(--bad)]"
          : "text-[var(--ink)]";

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_1px_0_rgba(15,40,40,0.04)]">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}
