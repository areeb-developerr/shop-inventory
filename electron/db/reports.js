const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { getDb, getSetting, logSync } = require("./index");

function reportsDir() {
  const dir = path.join(app.getPath("userData"), "ShopLedger", "reports");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildSummary(date) {
  const db = getDb();
  const sales = db
    .prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(subtotal),0) as total,
       COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(due_amount),0) as udhar
       FROM invoices WHERE date = ?`
    )
    .get(date);

  const collections = db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) as total FROM ledger_entries
       WHERE date = ? AND type = 'customer_payment'`
    )
    .get(date);

  const purchases = db
    .prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total,
       COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(due_amount),0) as credit
       FROM purchases WHERE date = ?`
    )
    .get(date);

  const supplierPayments = db
    .prepare(
      `SELECT COALESCE(SUM(ABS(amount)),0) as total FROM ledger_entries
       WHERE date = ? AND type = 'supplier_payment'`
    )
    .get(date);

  const accounts = db.prepare("SELECT * FROM accounts").all();
  const cashTotal = accounts.filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0);
  const bankTotal = accounts.filter((a) => a.type === "bank").reduce((s, a) => s + a.balance, 0);
  const receivable = db.prepare("SELECT COALESCE(SUM(balance),0) as t FROM customers").get().t;
  const payable = db.prepare("SELECT COALESCE(SUM(balance),0) as t FROM suppliers").get().t;

  const threshold = Number(getSetting("lowStockThreshold", "5"));
  const lowStock = db
    .prepare("SELECT name, stock_qty, low_stock_at FROM products WHERE stock_qty <= COALESCE(low_stock_at, ?)")
    .all(threshold);

  const invoices = db
    .prepare(
      `SELECT i.invoice_no, i.subtotal, i.paid_amount, i.due_amount, i.payment_type,
       COALESCE(c.name, 'Walk-in') as customer_name
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.date = ? ORDER BY i.created_at`
    )
    .all(date);

  return {
    date,
    storeName: getSetting("storeName", "Shop Ledger"),
    currency: getSetting("currency", "Rs"),
    generatedAt: new Date().toISOString(),
    sales,
    collections,
    purchases,
    supplierPayments,
    balances: { cashTotal, bankTotal, receivable, payable },
    lowStock,
    invoices,
  };
}

function toHtml(summary) {
  const fmt = (n) => `${summary.currency} ${(n / 100).toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;
  const rows = summary.invoices
    .map(
      (i) =>
        `<tr><td>${i.invoice_no}</td><td>${i.customer_name}</td><td>${fmt(i.subtotal)}</td><td>${i.payment_type}</td></tr>`
    )
    .join("");
  const lowRows = summary.lowStock
    .map((p) => `<tr><td>${p.name}</td><td>${p.stock_qty}</td></tr>`)
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Daily Report ${summary.date}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{margin:0}table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.card{border:1px solid #e5e7eb;border-radius:8px;padding:12px}</style></head><body>
<h1>${summary.storeName}</h1><p>Daily Report — ${summary.date}</p>
<div class="grid">
<div class="card"><strong>Sales</strong><br>${summary.sales.count} invoices · ${fmt(summary.sales.total)}</div>
<div class="card"><strong>Paid / Udhar</strong><br>${fmt(summary.sales.paid)} / ${fmt(summary.sales.udhar)}</div>
<div class="card"><strong>Udhar Collected</strong><br>${fmt(summary.collections.total)}</div>
<div class="card"><strong>Stock Purchased</strong><br>${summary.purchases.count} · ${fmt(summary.purchases.total)}</div>
<div class="card"><strong>Cash</strong><br>${fmt(summary.balances.cashTotal)}</div>
<div class="card"><strong>Bank</strong><br>${fmt(summary.balances.bankTotal)}</div>
<div class="card"><strong>Customer Udhar</strong><br>${fmt(summary.balances.receivable)}</div>
<div class="card"><strong>Supplier Payable</strong><br>${fmt(summary.balances.payable)}</div>
</div>
<h2>Invoices</h2><table><tr><th>No</th><th>Customer</th><th>Total</th><th>Payment</th></tr>${rows || "<tr><td colspan=4>No sales</td></tr>"}</table>
<h2>Low Stock</h2><table><tr><th>Item</th><th>Qty</th></tr>${lowRows || "<tr><td colspan=2>None</td></tr>"}</table>
<p style="color:#666;font-size:12px">Generated ${summary.generatedAt}</p></body></html>`;
}

function generate(date) {
  const db = getDb();
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const summary = buildSummary(targetDate);
  const html = toHtml(summary);
  const filePath = path.join(reportsDir(), `report-${targetDate}.html`);
  fs.writeFileSync(filePath, html, "utf8");

  const existing = db.prepare("SELECT id FROM daily_reports WHERE date = ?").get(targetDate);
  const summaryJson = JSON.stringify(summary);
  const generatedAt = new Date().toISOString();

  if (existing) {
    db.prepare(
      "UPDATE daily_reports SET generated_at=?, file_path=?, summary_json=?, synced_at=NULL WHERE date=?"
    ).run(generatedAt, filePath, summaryJson, targetDate);
    logSync("daily_reports", existing.id, "upsert");
  } else {
    const r = db
      .prepare(
        "INSERT INTO daily_reports (date, generated_at, file_path, summary_json) VALUES (?, ?, ?, ?)"
      )
      .run(targetDate, generatedAt, filePath, summaryJson);
    logSync("daily_reports", r.lastInsertRowid, "upsert");
  }

  return { ...summary, filePath, html };
}

function list() {
  return getDb()
    .prepare("SELECT id, date, generated_at, file_path, synced_at FROM daily_reports ORDER BY date DESC")
    .all();
}

function getByDate(date) {
  const row = getDb().prepare("SELECT * FROM daily_reports WHERE date = ?").get(date);
  if (!row) return null;
  return { ...row, summary: JSON.parse(row.summary_json) };
}

function readHtml(date) {
  const row = getDb().prepare("SELECT file_path FROM daily_reports WHERE date = ?").get(date);
  if (!row?.file_path || !fs.existsSync(row.file_path)) return null;
  return fs.readFileSync(row.file_path, "utf8");
}

module.exports = { generate, list, getByDate, readHtml, buildSummary };
