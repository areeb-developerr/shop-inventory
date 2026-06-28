import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { PageHeader, Money, Loading, ErrorBox, Modal } from "../components/shared";

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [detail, setDetail] = useState(null);

  const { data: invoices, loading, error, reload } = useAsync(
    () => api.invoices.list({ search, date: date || undefined }),
    [search, date]
  );

  const viewDetail = async (id) => {
    const inv = await api.invoices.get(id);
    setDetail(inv);
  };

  if (loading && !invoices) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Sales history"
        actions={
          <>
            <input type="date" className="input max-w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className="input max-w-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </>
        }
      />

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Udhar</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map((inv) => (
              <tr key={inv.id}>
                <td className="font-medium">{inv.invoice_no}</td>
                <td>{formatDate(inv.date)}</td>
                <td>{inv.customer_name || "Walk-in"}</td>
                <td><Money amount={inv.subtotal} /></td>
                <td><Money amount={inv.paid_amount} /></td>
                <td className={inv.due_amount > 0 ? "text-amber-600" : ""}>
                  <Money amount={inv.due_amount} />
                </td>
                <td className="capitalize">{inv.payment_type}</td>
                <td>
                  <button className="text-sm text-emerald-600" onClick={() => viewDetail(inv.id)}>View</button>
                </td>
              </tr>
            ))}
            {!invoices?.length && (
              <tr><td colSpan={8} className="text-center text-slate-500 py-8">No invoices</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.invoice_no || "Invoice"} wide>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">Customer:</span> {detail.customer_name || "Walk-in"}</div>
              <div><span className="text-slate-500">Date:</span> {formatDate(detail.date)}</div>
              <div><span className="text-slate-500">Payment:</span> <span className="capitalize">{detail.payment_type}</span></div>
              {detail.notes && <div className="col-span-2"><span className="text-slate-500">Notes:</span> {detail.notes}</div>}
            </div>
            <table className="data-table">
              <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
              <tbody>
                {detail.items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                    <td><Money amount={item.unit_price} /></td>
                    <td><Money amount={item.line_total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right space-y-1 text-sm">
              <div>Subtotal: <Money amount={detail.subtotal} /></div>
              <div>Paid: <Money amount={detail.paid_amount} /></div>
              {detail.due_amount > 0 && <div className="text-amber-600">Udhar: <Money amount={detail.due_amount} /></div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
