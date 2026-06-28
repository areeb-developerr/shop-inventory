const DEFAULT_CURRENCY = "Rs";

export function toPaisa(amount) {
  return Math.round(Number(amount) * 100);
}

export function fromPaisa(paisa, currency = DEFAULT_CURRENCY) {
  const n = Number(paisa) || 0;
  return `${currency} ${(n / 100).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
