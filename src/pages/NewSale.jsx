import { useState, useMemo } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { toPaisa } from "../lib/format";
import { PageHeader, Money, Loading, ErrorBox, FormField, SelectMenu, Textarea, MoneyInput, SearchInput, QtyInput } from "../components/shared";
import { validateMoney, validateQty, clampQty, parseQty } from "../lib/validate";

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
  const [fieldErrors, setFieldErrors] = useState({});

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
    if (product.stock_qty <= 0) return;
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      const nextQty = Math.min(existing.qty + 1, product.stock_qty);
      setCart(cart.map((c) =>
        c.productId === product.id
          ? { ...c, qty: nextQty, lineTotal: Math.round(nextQty * c.unitPrice), catalogPrice: c.catalogPrice ?? product.sell_price }
          : c
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        qty: 1,
        unitPrice: product.sell_price,
        catalogPrice: product.sell_price,
        lineTotal: product.sell_price,
        maxStock: product.stock_qty,
      }]);
    }
  };

  const updatePrice = (productId, rawPrice) => {
    const paisa = toPaisa(rawPrice || 0);
    setCart(cart.map((c) => {
      if (c.productId !== productId) return c;
      const qty = parseQty(c.qty) || 1;
      return { ...c, unitPrice: paisa, lineTotal: Math.round(qty * paisa) };
    }));
  };

  const updateQty = (productId, rawQty) => {
    const item = cart.find((c) => c.productId === productId);
    if (!item) return;
    const str = String(rawQty).trim();
    if (!str) {
      setCart(cart.map((c) => c.productId === productId ? { ...c, qty: "" } : c));
      return;
    }
    const n = parseQty(str);
    if (Number.isNaN(n) || n <= 0) {
      setCart(cart.filter((c) => c.productId !== productId));
      return;
    }
    const clamped = clampQty(n, 0.01, item.maxStock);
    setCart(cart.map((c) =>
      c.productId === productId
        ? { ...c, qty: clamped, lineTotal: Math.round(clamped * c.unitPrice) }
        : c
    ));
  };

  const validateSale = () => {
    const e = {};
    if (!cart.length) {
      setError("Add at least one item to the sale");
      return false;
    }
    for (const c of cart) {
      const qtyErr = validateQty(c.qty, { min: 0.01, max: c.maxStock, fieldName: `${c.name} quantity` });
      if (qtyErr) {
        e.cart = qtyErr;
        break;
      }
      const priceErr = validateMoney(String(c.unitPrice / 100), { min: 0.01, fieldName: `${c.name} price` });
      if (priceErr) {
        e.cart = priceErr;
        break;
      }
    }
    const cashErr = validateMoney(cashAmount, { min: 0, fieldName: "Cash amount" });
    if (cashErr) e.cash = cashErr;
    const bankErr = validateMoney(bankAmount, { min: 0, fieldName: "Bank amount" });
    if (bankErr) e.bank = bankErr;
    if (cashPaisa > 0 && !cashAccount) e.cash = "No cash account configured";
    if (bankPaisa > 0 && !bankAccount) e.bank = "No bank account configured";
    if (due > 0 && !customerId) e.customer = "Select a customer for udhar (credit) sales";
    if (due < 0) e.payment = "Total paid cannot exceed sale amount";
    if (subtotal > 0 && paid === 0 && !customerId) e.customer = "Select a customer for full udhar sale";
    setFieldErrors(e);
    if (Object.keys(e).length) {
      setError(e.cart || e.payment || e.customer || e.cash || e.bank || "Please fix the errors below");
      return false;
    }
    setError("");
    return true;
  };

  const submit = async () => {
    if (!validateSale()) return;
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
      setFieldErrors({});
      setTab("invoices");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const payFullCash = () => {
    setCashAmount(subtotal > 0 ? String(Math.round(subtotal / 100)) : "");
    setBankAmount("");
    setFieldErrors({});
  };

  const payFullUdhar = () => {
    setCashAmount("");
    setBankAmount("");
    setFieldErrors({});
  };

  if (loadingProducts) return <Loading />;

  return (
    <div>
      <PageHeader title="New Sale" subtitle="Create invoice and update stock" />

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SearchInput
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="card divide-y divide-slate-100 dark:divide-slate-700 max-h-64 overflow-y-auto">
            {!products?.length ? (
              <p className="px-4 py-6 text-center text-slate-500 text-sm">
                No items in catalog. Add products from the Items page first.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-slate-500 text-sm">No products match your search</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full flex justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left disabled:opacity-40"
                  onClick={() => addToCart(p)}
                  disabled={p.stock_qty <= 0}
                >
                  <span>
                    {p.name}{" "}
                    <span className={`text-sm ${p.stock_qty <= 0 ? "text-red-400" : "text-slate-400"}`}>
                      ({p.stock_qty} in stock)
                    </span>
                  </span>
                  <Money amount={p.sell_price} />
                </button>
              ))
            )}
          </div>

          <div className="card">
            <div className="table-wrap border-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((c) => (
                    <tr key={c.productId}>
                      <td>
                        <span className="font-medium">{c.name}</span>
                        {c.catalogPrice != null && c.unitPrice !== c.catalogPrice && (
                          <span className="block text-xs text-slate-400">
                            List: <Money amount={c.catalogPrice} />
                          </span>
                        )}
                      </td>
                      <td>
                        <QtyInput
                          className="w-24"
                          value={c.qty}
                          onChange={(e) => updateQty(c.productId, e.target.value)}
                          onBlur={() => {
                            if (!c.qty || parseQty(c.qty) <= 0) updateQty(c.productId, 1);
                          }}
                        />
                      </td>
                      <td>
                        <MoneyInput
                          className="w-32 h-9"
                          value={c.unitPrice ? String(c.unitPrice / 100) : ""}
                          onChange={(e) => updatePrice(c.productId, e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td><Money amount={c.lineTotal} /></td>
                      <td>
                        <button className="text-red-500 text-sm" onClick={() => updateQty(c.productId, 0)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                  {!cart.length && (
                    <tr><td colSpan={5} className="text-center text-slate-500 py-8">Click a product above to add to sale</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-5 h-fit">
          <FormField label="Customer" error={fieldErrors.customer}>
            <SelectMenu
              value={customerId}
              onChange={(v) => { setCustomerId(v); setFieldErrors((f) => ({ ...f, customer: null })); }}
              error={fieldErrors.customer}
              placeholder="Walk-in customer"
              options={[
                { value: "", label: "Walk-in customer" },
                ...(customers?.map((c) => ({ value: String(c.id), label: c.name })) || []),
              ]}
            />
          </FormField>

          <div className="text-lg font-semibold flex justify-between py-1 border-y border-slate-100 dark:border-slate-700">
            <span>Subtotal</span>
            <Money amount={subtotal} />
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm flex-1 h-9" onClick={payFullCash}>Full Cash</button>
            <button type="button" className="btn-secondary text-sm flex-1 h-9" onClick={payFullUdhar}>Full Udhar</button>
          </div>

          <FormField label="Cash received" hint="Amount paid in cash" error={fieldErrors.cash}>
            <MoneyInput value={cashAmount} onChange={(e) => { setCashAmount(e.target.value); setFieldErrors((f) => ({ ...f, cash: null })); }} placeholder="0" error={fieldErrors.cash} />
          </FormField>
          <FormField label="Bank received" hint="Amount paid to bank account" error={fieldErrors.bank}>
            <MoneyInput value={bankAmount} onChange={(e) => { setBankAmount(e.target.value); setFieldErrors((f) => ({ ...f, bank: null })); }} placeholder="0" error={fieldErrors.bank} />
          </FormField>

          {due > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-amber-700 dark:text-amber-300 text-sm font-medium">
              Udhar: <Money amount={due} />
            </div>
          )}
          {due < 0 && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-red-600 text-sm">
              Overpaid by <Money amount={-due} />
            </div>
          )}

          <FormField label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note for this sale" />
          </FormField>

          <button className="btn-primary w-full h-11" disabled={saving || !cart.length} onClick={submit}>
            {saving ? "Saving…" : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}
