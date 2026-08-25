export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 border-l-4 border-yellow-400 pl-3">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CollapsibleCard({
  title,
  defaultOpen = false,
  className = "",
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className={`group rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
        {title}
        <span className="ml-2 text-slate-400 transition-transform group-open:rotate-90">▸</span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none";

export const buttonClass =
  "rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50";

export const iconButtonClass =
  "rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600";
