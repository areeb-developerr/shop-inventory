import { fromPaisa, formatDate } from "../lib/format";
import { Money, PaymentBadge } from "./shared";

function SummaryCard({ label, value, sub }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ReportView({ summary, onPrint }) {
  if (!summary) return null;
  const currency = summary.currency || "Rs";
  const fmt = (n) => fromPaisa(n, currency);
  const invoices = summary.invoices || [];
  const invoiceTotal = invoices.reduce((s, i) => s + (i.subtotal || 0), 0);

  return (
    <div className="report-view space-y-6" id="report-print-area">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">{summary.storeName}</h3>
          <p className="text-slate-500 dark:text-slate-400">Daily Report — {formatDate(summary.date)}</p>
        </div>
        {onPrint && (
          <button type="button" className="btn-secondary text-sm" onClick={onPrint}>
            Print
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Sales"
          value={fmt(summary.sales?.total || 0)}
          sub={`${summary.sales?.count || 0} invoices`}
        />
        <SummaryCard
          label="Paid / Udhar"
          value={`${fmt(summary.sales?.paid || 0)} / ${fmt(summary.sales?.udhar || 0)}`}
        />
        <SummaryCard label="Udhar Collected" value={fmt(summary.collections?.total || 0)} />
        <SummaryCard
          label="Stock Purchased"
          value={fmt(summary.purchases?.total || 0)}
          sub={`${summary.purchases?.count || 0} purchases`}
        />
        <SummaryCard label="Supplier Payments" value={fmt(summary.supplierPayments?.total || 0)} />
        <SummaryCard label="Cash Balance" value={fmt(summary.balances?.cashTotal || 0)} />
        <SummaryCard label="Bank Balance" value={fmt(summary.balances?.bankTotal || 0)} />
        <SummaryCard label="Customer Udhar" value={fmt(summary.balances?.receivable || 0)} />
        <SummaryCard label="Supplier Payable" value={fmt(summary.balances?.payable || 0)} />
      </div>

      <div>
        <h4 className="font-semibold mb-2">Invoices</h4>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Udhar</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.invoice_no}>
                  <td className="font-medium">{inv.invoice_no}</td>
                  <td>{inv.customer_name}</td>
                  <td>{fmt(inv.subtotal)}</td>
                  <td>{fmt(inv.paid_amount)}</td>
                  <td className={inv.due_amount > 0 ? "text-amber-600 font-medium" : ""}>{fmt(inv.due_amount)}</td>
                  <td><PaymentBadge type={inv.payment_type} /></td>
                </tr>
              ))}
              {!invoices.length && (
                <tr><td colSpan={6} className="text-center text-slate-500 py-6">No sales today</td></tr>
              )}
              {invoices.length > 0 && (
                <tr className="font-semibold bg-slate-50 dark:bg-slate-900">
                  <td colSpan={2}>Total</td>
                  <td>{fmt(invoiceTotal)}</td>
                  <td>{fmt(summary.sales?.paid || 0)}</td>
                  <td>{fmt(summary.sales?.udhar || 0)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(summary.lowStock?.length > 0) && (
        <div>
          <h4 className="font-semibold mb-2 text-amber-600 dark:text-amber-400">Low Stock</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Alert At</th>
                </tr>
              </thead>
              <tbody>
                {summary.lowStock.map((p) => (
                  <tr key={p.name} className="bg-amber-50/50 dark:bg-amber-900/10">
                    <td className="font-medium">{p.name}</td>
                    <td className="text-amber-700 dark:text-amber-300">{p.stock_qty}</td>
                    <td>{p.low_stock_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-4">
        Generated {summary.generatedAt ? new Date(summary.generatedAt).toLocaleString() : "—"}
      </p>
    </div>
  );
}
