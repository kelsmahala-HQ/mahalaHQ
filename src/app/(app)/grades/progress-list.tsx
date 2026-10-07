import type { ClassProgress } from "@/lib/grades";

const TREND = {
  up: { icon: "▲", className: "text-teal-600" },
  down: { icon: "▼", className: "text-red-500" },
  same: { icon: "–", className: "text-slate-300" },
} as const;

/** Each class: where it started, where it is now, what it pays this week, and the next step up. */
export default function ProgressList({ rows }: { rows: ClassProgress[] }) {
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div
          key={r.name}
          className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm ${
            r.failing ? "bg-red-50" : "bg-slate-50"
          }`}
        >
          <span className="font-medium text-slate-900">{r.name}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-slate-500">
              {r.baseGrade !== r.latestGrade && <span className="text-slate-400">{r.baseGrade} → </span>}
              <span className="font-semibold text-slate-800">{r.latestGrade}</span>{" "}
              <span className={TREND[r.trend].className}>{TREND[r.trend].icon}</span>
            </span>
            {r.weeklyDollars > 0 && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                earning ${r.weeklyDollars}/wk
              </span>
            )}
            {r.next && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                {r.next.label}: +${r.next.dollars}/wk
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
