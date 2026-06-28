import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { StatCard, PageHeader, Money, Loading, ErrorBox } from "../components/shared";
import { formatDate } from "../lib/format";

export default function Dashboard({ setTab }) {
  const { data, loading, error, reload } = useAsync(() => api.dashboard.summary(), []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Overview for ${formatDate(new Date().toISOString())}`}
        actions={
          <button className="btn-primary" onClick={() => setTab("new-sale")}>
            New Sale
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Cash + Bank" value={<Money amount={data.moneyTotal} />} accent="emerald" />
        <StatCard label="Customer Udhar" value={<Money amount={data.receivable} />} sub="To collect" accent="amber" />
        <StatCard label="Supplier Payable" value={<Money amount={data.payable} />} sub="To pay" accent="rose" />
        <StatCard
          label="Today's Sales"
          value={<Money amount={data.todaySales.total} />}
          sub={`${data.todaySales.count} invoices`}
          accent="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Accounts</h2>
          <div className="space-y-2">
            {data.accounts?.length ? (
              data.accounts.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span className="text-slate-500">{a.name} ({a.type})</span>
                  <Money amount={a.balance} />
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm">No accounts</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Low Stock ({data.lowStockCount})</h2>
            <button className="text-sm text-emerald-600" onClick={() => setTab("items")}>View all</button>
          </div>
          {data.lowStock?.length ? (
            <ul className="space-y-1 text-sm">
              {data.lowStock.slice(0, 5).map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-red-500">{p.stock_qty} left</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm">All items stocked</p>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Recent Invoices</h2>
            <button className="text-sm text-emerald-600" onClick={() => setTab("invoices")}>View all</button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices?.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_no}</td>
                    <td>{inv.customer_name || "Walk-in"}</td>
                    <td><Money amount={inv.subtotal} /></td>
                    <td className="capitalize">{inv.payment_type}</td>
                  </tr>
                ))}
                {!data.recentInvoices?.length && (
                  <tr><td colSpan={4} className="text-center text-slate-500">No sales yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
