import { fromPaisa } from "../lib/format";

export function StatCard({ label, value, sub, accent = "emerald" }) {
  const colors = {
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-blue-500 to-indigo-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-pink-600",
  };
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${colors[accent]} bg-clip-text text-transparent`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Money({ amount, currency = "Rs" }) {
  return <span>{fromPaisa(amount, currency)}</span>;
}

export function EmptyState({ message }) {
  return (
    <div className="card p-12 text-center text-slate-500 dark:text-slate-400">
      {message}
    </div>
  );
}

export function Loading() {
  return <div className="p-8 text-center text-slate-500">Loading…</div>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="card p-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-2 text-sm">
          Retry
        </button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className={`card w-full ${wide ? "max-w-2xl" : "max-w-md"} p-6 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
