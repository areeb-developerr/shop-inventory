import { useState, useMemo } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { toPaisa } from "../lib/format";
import { PageHeader, Money, Loading, ErrorBox } from "../components/shared";

export default function NewSale({ setTab }) {
  const { data: products, loading: loadingProducts } = useAsync(() => api.products.list(), []);
  const { data: customers } = useAsync(() => api.customers.list(), []);
  const { data: accounts } = useAsync(() => api.accounts.list(), []);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [bankAmount, setBankAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const cashAccount = accounts?.find((a) => a.type === "cash" && a.is_default) || accounts?.find((a) => a.type === "cash");
  const bankAccount = accounts?.find((a) => a.type === "bank");

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const subtotal = cart.reduce((s, c) => s + c.lineTotal, 0);
  const cashPaisa = toPaisa(cashAmount || 0);
  const bankPaisa = toPaisa(bankAmount || 0);
  const paid = cashPaisa + bankPaisa;
  const due = subtotal - paid;

  const addToCart = (product) => {
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      setCart(cart.map((c) =>
        c.productId === product.id
          ? { ...c, qty: c.qty + 1, lineTotal: Math.round((c.qty + 1) * c.unitPrice) }
          : c
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        qty: 1,
        unitPrice: product.sell_price,
        lineTotal: product.sell_price,
        maxStock: product.stock_qty,
      }]);
    }
    setSearch("");
  };

  const updateQty = (productId, qty) => {
    const n = Math.max(0, Number(qty));
    if (n === 0) {
      setCart(cart.filter((c) => c.productId !== productId));
      return;
    }
    setCart(cart.map((c) =>
      c.productId === productId
        ? { ...c, qty: n, lineTotal: Math.round(n * c.unitPrice) }
        : c
    ));
  };

  const payFullCash = () => {
    setCashAmount((subtotal / 100).toFixed(0));
    setBankAmount("");
  };

  const payFullUdhar = () => {
    setCashAmount("");
    setBankAmount("");
  };

  const submit = async () => {
    setError("");
    if (!cart.length) return setError("Add items to cart");
    if (due > 0 && !customerId) return setError("Select customer for udhar");
    setSaving(true);
    try {
      await api.sales.create({
        customerId: customerId ? Number(customerId) : null,
        items: cart.map((c) => ({ productId: c.productId, qty: c.qty, unitPrice: c.unitPrice })),
        cashAmount: cashPaisa,
        bankAmount: bankPaisa,
        accountId: cashPaisa > 0 ? cashAccount?.id : null,
        bankAccountId: bankPaisa > 0 ? bankAccount?.id : null,
        notes,
      });
      setCart([]);
      setCashAmount("");
      setBankAmount("");
      setNotes("");
      setCustomerId("");
      setTab("invoices");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingProducts) return <Loading />;

  return (
    <div>
      <PageHeader title="New Sale" subtitle="Create invoice and update stock" />

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <input
            className="input"
            placeholder="Search product to add…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <div className="card divide-y divide-slate-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
              {filtered.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full flex justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left"
                  onClick={() => addToCart(p)}
                >
                  <span>{p.name} <span className="text-slate-400 text-sm">({p.stock_qty} in stock)</span></span>
                  <Money amount={p.sell_price} />
                </button>
              ))}
            </div>
          )}

          <div className="card">
            <div className="table-wrap border-0">
              <table className="data-table">
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr>
                </thead>
                <tbody>
                  {cart.map((c) => (
                    <tr key={c.productId}>
                      <td>{c.name}</td>
                      <td>
                        <input
                          type="number"
                          className="input w-20"
                          value={c.qty}
                          min={1}
                          max={c.maxStock}
                          onChange={(e) => updateQty(c.productId, e.target.value)}
                        />
                      </td>
                      <td><Money amount={c.unitPrice} /></td>
                      <td><Money amount={c.lineTotal} /></td>
                      <td>
                        <button className="text-red-500 text-sm" onClick={() => updateQty(c.productId, 0)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                  {!cart.length && (
                    <tr><td colSpan={5} className="text-center text-slate-500 py-8">Search and add products</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-4 h-fit">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in</option>
              {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="text-lg font-semibold flex justify-between">
            <span>Subtotal</span>
            <Money amount={subtotal} />
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm flex-1" onClick={payFullCash}>Full Cash</button>
            <button type="button" className="btn-secondary text-sm flex-1" onClick={payFullUdhar}>Full Udhar</button>
          </div>

          <div>
            <label className="label">Cash received (Rs)</label>
            <input type="number" className="input" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Bank received (Rs)</label>
            <input type="number" className="input" value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} />
          </div>

          {due > 0 && (
            <div className="text-amber-600 text-sm font-medium">
              Udhar: <Money amount={due} />
            </div>
          )}
          {due < 0 && <div className="text-red-500 text-sm">Overpaid by <Money amount={-due} /></div>}

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <button className="btn-primary w-full" disabled={saving || !cart.length || due < 0} onClick={submit}>
            {saving ? "Saving…" : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
