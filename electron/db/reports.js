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
  const badge = (type) => {
    const colors = { cash: "#059669", udhar: "#d97706", bank: "#2563eb", mixed: "#7c3aed" };
    const c = colors[type] || "#64748b";
    return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;text-transform:capitalize;background:${c}22;color:${c}">${type}</span>`;
  };

  const invoiceRows = summary.invoices
    .map(
      (i) =>
        `<tr>
          <td>${i.invoice_no}</td>
          <td>${i.customer_name}</td>
          <td style="text-align:right">${fmt(i.subtotal)}</td>
          <td style="text-align:right">${fmt(i.paid_amount)}</td>
          <td style="text-align:right">${fmt(i.due_amount)}</td>
          <td>${badge(i.payment_type)}</td>
        </tr>`
    )
    .join("");

  const invoiceTotal = summary.invoices.reduce((s, i) => s + i.subtotal, 0);
  const totalsRow = summary.invoices.length
    ? `<tr class="totals"><td colspan="2"><strong>Total</strong></td>
       <td style="text-align:right"><strong>${fmt(invoiceTotal)}</strong></td>
       <td style="text-align:right"><strong>${fmt(summary.sales.paid)}</strong></td>
       <td style="text-align:right"><strong>${fmt(summary.sales.udhar)}</strong></td><td></td></tr>`
    : "";

  const lowRows = summary.lowStock
    .map((p) => `<tr class="low"><td>${p.name}</td><td style="text-align:right">${p.stock_qty}</td><td style="text-align:right">${p.low_stock_at}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Daily Report — ${summary.date} — ${summary.storeName}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; font-size: 13px; line-height: 1.5; margin: 0; padding: 0; }
  .page { max-width: 210mm; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { width: 48px; height: 48px; background: linear-gradient(135deg,#059669,#0d9488); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 18px; }
  h1 { margin: 0; font-size: 22px; }
  .subtitle { color: #64748b; margin: 4px 0 0; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; background: #f8fafc; }
  .card label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-bottom: 4px; }
  .card strong { font-size: 16px; }
  .card small { display: block; color: #94a3b8; font-size: 11px; margin-top: 2px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
  tr.totals td { background: #f8fafc; border-top: 2px solid #cbd5e1; }
  tr.low td { background: #fffbeb; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div style="display:flex;gap:14px;align-items:center">
      <div class="logo">${(summary.storeName || "S").charAt(0)}</div>
      <div>
        <h1>${summary.storeName}</h1>
        <p class="subtitle">Daily Report — ${summary.date}</p>
      </div>
    </div>
  </div>

  <div class="grid">
    <div class="card"><label>Sales</label><strong>${fmt(summary.sales.total)}</strong><small>${summary.sales.count} invoices</small></div>
    <div class="card"><label>Paid / Udhar</label><strong>${fmt(summary.sales.paid)} / ${fmt(summary.sales.udhar)}</strong></div>
    <div class="card"><label>Udhar Collected</label><strong>${fmt(summary.collections.total)}</strong></div>
    <div class="card"><label>Stock Purchased</label><strong>${fmt(summary.purchases.total)}</strong><small>${summary.purchases.count} purchases</small></div>
    <div class="card"><label>Supplier Payments</label><strong>${fmt(summary.supplierPayments.total)}</strong></div>
    <div class="card"><label>Cash</label><strong>${fmt(summary.balances.cashTotal)}</strong></div>
    <div class="card"><label>Bank</label><strong>${fmt(summary.balances.bankTotal)}</strong></div>
    <div class="card"><label>Customer Udhar</label><strong>${fmt(summary.balances.receivable)}</strong></div>
    <div class="card"><label>Supplier Payable</label><strong>${fmt(summary.balances.payable)}</strong></div>
  </div>

  <h2>Invoices</h2>
  <table>
    <tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Paid</th><th>Udhar</th><th>Payment</th></tr>
    ${invoiceRows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8">No sales today</td></tr>'}
    ${totalsRow}
  </table>

  <h2>Low Stock</h2>
  <table>
    <tr><th>Item</th><th>Qty</th><th>Alert At</th></tr>
    ${lowRows || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">None</td></tr>'}
  </table>

  <div class="footer">Generated ${new Date(summary.generatedAt).toLocaleString()}</div>
</div>
</body>
</html>`;
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
