import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { fromPaisa } from "../lib/format";
import { Search, ChevronDown, X } from "lucide-react";
import { sanitizeMoneyInput, sanitizeQtyInput } from "../lib/validate";

function fieldClass(base, error, className) {
  return [base, error ? "input-error" : "", className].filter(Boolean).join(" ");
}

export function FormField({ label, hint, required, error, children, className = "" }) {
  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="field-error">{error}</p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  );
}

export function Input({ className = "", error, onWheel, ...props }) {
  return (
    <input
      className={fieldClass("input", error, className)}
      onWheel={props.type === "number" ? (e) => { e.currentTarget.blur(); onWheel?.(e); } : onWheel}
      {...props}
    />
  );
}

export function InputSm({ className = "", error, ...props }) {
  return (
    <input
      className={fieldClass("input input-sm input-numeric", error, className)}
      inputMode={props.inputMode || "numeric"}
      {...props}
    />
  );
}

export function Select({ className = "", error, children, ...props }) {
  return (
    <select className={fieldClass("input", error, className)} {...props}>
      {children}
    </select>
  );
}

export function SelectMenu({ value, onChange, options = [], placeholder = "Select…", error, className = "", disabled }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open) setHighlight(-1);
  }, [open]);

  const pick = useCallback((val) => {
    onChange?.(val);
    setOpen(false);
  }, [onChange]);

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(options[highlight].value);
    }
  };

  useEffect(() => {
    if (highlight >= 0 && listRef.current) {
      const el = listRef.current.children[highlight];
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlight]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        className={fieldClass("input text-left flex items-center justify-between gap-2", error, "w-full")}
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={!selected ? "text-slate-400 dark:text-slate-500" : "truncate"}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul ref={listRef} className="select-menu-panel" role="listbox">
          {options.map((opt, i) => (
            <li
              key={String(opt.value)}
              role="option"
              aria-selected={String(opt.value) === String(value)}
              className={`select-menu-option ${String(opt.value) === String(value) ? "select-menu-option-active" : ""} ${i === highlight ? "bg-slate-100 dark:bg-slate-700" : ""}`}
              onClick={() => pick(opt.value)}
              onMouseEnter={() => setHighlight(i)}
            >
              {opt.label}
            </li>
          ))}
          {!options.length && (
            <li className="px-4 py-2.5 text-sm text-slate-400">No options</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function Textarea({ className = "", error, ...props }) {
  return <textarea className={fieldClass("input", error, className)} {...props} />;
}

export function MoneyInput({ prefix = "Rs", className = "", error, value, onChange, allowNegative = false, ...props }) {
  return (
    <div className="input-group">
      <span className="input-prefix">{prefix}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={fieldClass("input input-numeric", error, className)}
        value={value}
        onChange={(e) => {
          let next = sanitizeMoneyInput(e.target.value);
          if (!allowNegative) next = next.replace(/-/g, "");
          onChange?.({ ...e, target: { ...e.target, value: next } });
        }}
        onWheel={(e) => e.currentTarget.blur()}
        {...props}
      />
    </div>
  );
}

export function QtyInput({ className = "", error, value, onChange, integer = false, ...props }) {
  return (
    <input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      autoComplete="off"
      className={fieldClass("input input-numeric", error, className)}
      value={value}
      onChange={(e) => {
        const next = sanitizeQtyInput(e.target.value, integer);
        onChange?.({ ...e, target: { ...e.target, value: next } });
      }}
      onWheel={(e) => e.currentTarget.blur()}
      {...props}
    />
  );
}

export function SearchInput({ className = "", ...props }) {
  return (
    <div className={`search-field ${className}`}>
      <Search className="search-icon" />
      <input type="search" className="input" {...props} />
    </div>
  );
}

export function Checkbox({ label, checked, onChange, className = "" }) {
  return (
    <label className={`checkbox-field ${className}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label && <span className="checkbox-label">{label}</span>}
    </label>
  );
}

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

function PaymentBadge({ type }) {
  const cls = {
    cash: "badge-cash",
    udhar: "badge-udhar",
    bank: "badge-bank",
    mixed: "badge-mixed",
  }[type] || "badge";
  return <span className={cls}>{type}</span>;
}

export { PaymentBadge };

export function Modal({ open, onClose, title, children, wide }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("modal-open");
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelector("input, button, select, textarea");
      focusable?.focus();
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={`card-elevated relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-md"} p-6 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
          <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost w-9 h-9 p-0 rounded-full"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
