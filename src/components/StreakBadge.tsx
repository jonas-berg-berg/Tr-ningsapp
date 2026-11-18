export function StreakBadge({ icon, value, unit, hint }: { icon: string; value: number; unit: string; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-bold" title={hint}>
      <span aria-hidden>{icon}</span>
      <span>
        {value} {unit}
      </span>
      {hint && <span className="sr-only">{hint}</span>}
    </div>
  );
}
