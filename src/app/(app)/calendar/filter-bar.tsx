import Link from "next/link";
import { EVENT_TYPES } from "./event-types";

const EXTRA_FILTERS = [
  { value: "bills", label: "Bills", icon: "💳" },
  { value: "chores", label: "Chores", icon: "🧹" },
  { value: "external", label: "Google Calendar", icon: "📅" },
] as const;

export const ALL_FILTER_KEYS = [...EXTRA_FILTERS.map((f) => f.value), ...EVENT_TYPES.map((t) => t.value)];

export function parseHidden(hide?: string): Set<string> {
  return new Set(
    (hide ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export default function FilterBar({
  basePath,
  extraParams,
  hidden,
}: {
  basePath: string;
  extraParams: Record<string, string>;
  hidden: Set<string>;
}) {
  const allFilters = [...EXTRA_FILTERS, ...EVENT_TYPES.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))];

  function hrefFor(key: string) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const params = new URLSearchParams(extraParams);
    if (next.size) params.set("hide", [...next].join(","));
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-slate-400">Show:</span>
      {allFilters.map((f) => {
        const isHidden = hidden.has(f.value);
        return (
          <Link
            key={f.value}
            href={hrefFor(f.value)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              isHidden ? "border-slate-200 bg-slate-50 text-slate-400 line-through" : "border-teal-200 bg-teal-50 text-teal-700"
            }`}
          >
            {f.icon ? `${f.icon} ` : ""}
            {f.label}
          </Link>
        );
      })}
      {hidden.size > 0 && (
        <Link href={basePath + (Object.keys(extraParams).length ? `?${new URLSearchParams(extraParams).toString()}` : "")} className="text-xs text-slate-400 hover:text-teal-600">
          Reset
        </Link>
      )}
    </div>
  );
}
