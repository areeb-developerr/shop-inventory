import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { toPaisa } from "../lib/format";
import { PageHeader, Money, Loading, ErrorBox, Modal } from "../components/shared";

export default function People() {
  const [tab, setTab] = useState("customers");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [editing, setEditing] = useState(null);
  const [payForm, setPayForm] = useState({ partyId: null, amount: "", accountId: "" });
  const [purchaseForm, setPurchaseForm] = useState({ supplierId: "", items: [], paidAmount: "", accountId: "" });
  const [productPick, setProductPick] = useState({ productId: "", qty: 1 });
  const [msg, setMsg] = useState("");

  const { data: customers, reload: reloadCustomers } = useAsync(
    () => api.customers.list({ search }),
    [search, tab]
  );
  const { data: suppliers, reload: reloadSuppliers } = useAsync(
    () => api.suppliers.list({ search }),
    [search, tab]
  );
  const { data: accounts } = useAsync(() => api.accounts.list(), []);
  const { data: products } = useAsync(() => api.products.list(), []);

  const reload = () => {
    reloadCustomers();
    reloadSuppliers();
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", phone: "", notes: "" });
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({ name: p.name, phone: p.phone || "", notes: p.notes || "" });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (tab === "customers") {
      if (editing) await api.customers.update(editing, form);
      else await api.customers.create(form);
    } else {
      if (editing) await api.suppliers.update(editing, form);
      else await api.suppliers.create(form);
    }
    setOpen(false);
    reload();
    setMsg("Saved");
    setTimeout(() => setMsg(""), 2000);
  };

  const openPay = (party) => {
    setPayForm({ partyId: party.id, amount: (party.balance / 100).toFixed(0), accountId: accounts?.[0]?.id || "" });
    setPayOpen(true);
  };

  const submitPay = async (e) => {
    e.preventDefault();
    const amount = toPaisa(payForm.amount);
    if (tab === "customers") {
      await api.customers.pay({ customerId: payForm.partyId, accountId: Number(payForm.accountId), amount });
    } else {
      await api.suppliers.pay({ supplierId: payForm.partyId, accountId: Number(payForm.accountId), amount });
    }
    setPayOpen(false);
    reload();
  };

  const addPurchaseItem = () => {
    const product = products?.find((p) => p.id === Number(productPick.productId));
    if (!product) return;
    setPurchaseForm({
      ...purchaseForm,
      items: [
        ...purchaseForm.items,
        { productId: product.id, name: product.name, qty: Number(productPick.qty), unitCost: product.cost_price },
      ],
    });
    setProductPick({ productId: "", qty: 1 });
  };

  const submitPurchase = async (e) => {
    e.preventDefault();
    await api.purchases.create({
      supplierId: Number(purchaseForm.supplierId),
      items: purchaseForm.items.map((i) => ({ productId: i.productId, qty: i.qty, unitCost: i.unitCost })),
      paidAmount: toPaisa(purchaseForm.paidAmount || 0),
      accountId: purchaseForm.paidAmount ? Number(purchaseForm.accountId) : null,
    });
    setPurchaseOpen(false);
    setPurchaseForm({ supplierId: "", items: [], paidAmount: "", accountId: "" });
    reload();
    setMsg("Stock purchase recorded");
    setTimeout(() => setMsg(""), 2000);
  };

  const list = tab === "customers" ? customers : suppliers;

  return (
    <div>
      <PageHeader
        title="People"
        subtitle="Customers, suppliers, udhar & payables"
        actions={
          <>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
              <button
                className={`px-4 py-2 text-sm ${tab === "customers" ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-800"}`}
                onClick={() => setTab("customers")}
              >
                Customers
              </button>
              <button
                className={`px-4 py-2 text-sm ${tab === "suppliers" ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-800"}`}
                onClick={() => setTab("suppliers")}
              >
                Suppliers
              </button>
            </div>
            <input className="input max-w-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {tab === "suppliers" && (
              <button className="btn-secondary" onClick={() => setPurchaseOpen(true)}>Stock In</button>
            )}
            <button className="btn-primary" onClick={openNew}>
              Add {tab === "customers" ? "Customer" : "Supplier"}
            </button>
          </>
        }
      />
      {msg && <div className="mb-4 text-sm text-emerald-600">{msg}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>{tab === "customers" ? "Owes Us" : "We Owe"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list?.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td>{p.phone || "—"}</td>
                <td className={p.balance > 0 ? "text-amber-600 font-medium" : ""}>
                  <Money amount={p.balance} />
                </td>
                <td className="text-right space-x-2">
                  {p.balance > 0 && (
                    <button className="text-sm text-emerald-600" onClick={() => openPay(p)}>
                      {tab === "customers" ? "Collect" : "Pay"}
                    </button>
                  )}
                  <button className="text-sm text-slate-500" onClick={() => openEdit(p)}>Edit</button>
                </td>
              </tr>
            ))}
            {!list?.length && (
              <tr><td colSpan={4} className="text-center text-slate-500 py-8">No entries</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit" : "Add"}>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">Save</button>
        </form>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={tab === "customers" ? "Collect Udhar" : "Pay Supplier"}>
        <form onSubmit={submitPay} className="space-y-3">
          <div>
            <label className="label">Amount (Rs)</label>
            <input type="number" className="input" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">To/From Account</label>
            <select className="input" value={payForm.accountId} onChange={(e) => setPayForm({ ...payForm, accountId: e.target.value })}>
              {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">Confirm</button>
        </form>
      </Modal>

      <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title="Stock Purchase" wide>
        <form onSubmit={submitPurchase} className="space-y-4">
          <div>
            <label className="label">Supplier *</label>
            <select className="input" required value={purchaseForm.supplierId} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}>
              <option value="">Select supplier</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="label">Product</label>
              <select className="input" value={productPick.productId} onChange={(e) => setProductPick({ ...productPick, productId: e.target.value })}>
                <option value="">Select</option>
                {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="w-24">
              <label className="label">Qty</label>
              <input type="number" className="input" value={productPick.qty} onChange={(e) => setProductPick({ ...productPick, qty: e.target.value })} />
            </div>
            <button type="button" className="btn-secondary" onClick={addPurchaseItem}>Add</button>
          </div>
          {purchaseForm.items.length > 0 && (
            <ul className="text-sm space-y-1">
              {purchaseForm.items.map((i, idx) => (
                <li key={idx}>{i.name} × {i.qty}</li>
              ))}
            </ul>
          )}
          <div>
            <label className="label">Paid now (Rs) — leave 0 for full credit</label>
            <input type="number" className="input" value={purchaseForm.paidAmount} onChange={(e) => setPurchaseForm({ ...purchaseForm, paidAmount: e.target.value })} />
          </div>
          {purchaseForm.paidAmount > 0 && (
            <div>
              <label className="label">Pay from account</label>
              <select className="input" value={purchaseForm.accountId} onChange={(e) => setPurchaseForm({ ...purchaseForm, accountId: e.target.value })}>
                {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={!purchaseForm.items.length}>Record Purchase</button>
        </form>
      </Modal>
    </div>
  );
}
