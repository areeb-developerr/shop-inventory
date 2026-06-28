import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { toPaisa } from "../lib/format";
import { PageHeader, Money, Loading, ErrorBox, Modal, FormField, Input, Select, Textarea, MoneyInput, QtyInput, SearchInput } from "../components/shared";
import { validateName, validatePhone, validateMoney, validateSelect, validateQty, parseMoney } from "../lib/validate";

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
  const [productPick, setProductPick] = useState({ productId: "", qty: "1" });
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState({});
  const [payParty, setPayParty] = useState(null);

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
    setErrors({});
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({ name: p.name, phone: p.phone || "", notes: p.notes || "" });
    setErrors({});
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const eMap = {};
    const nameErr = validateName(form.name);
    if (nameErr) eMap.name = nameErr;
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) eMap.phone = phoneErr;
    setErrors(eMap);
    if (Object.keys(eMap).length) return;
    const payload = { name: form.name.trim(), phone: form.phone.trim(), notes: form.notes.trim() };
    if (tab === "customers") {
      if (editing) await api.customers.update(editing, payload);
      else await api.customers.create(payload);
    } else {
      if (editing) await api.suppliers.update(editing, payload);
      else await api.suppliers.create(payload);
    }
    setOpen(false);
    setErrors({});
    reload();
    setMsg("Saved");
    setTimeout(() => setMsg(""), 2000);
  };

  const openPay = (party) => {
    setPayParty(party);
    setPayForm({ partyId: party.id, amount: String(Math.round(party.balance / 100)), accountId: accounts?.[0]?.id || "" });
    setErrors({});
    setPayOpen(true);
  };

  const submitPay = async (e) => {
    e.preventDefault();
    const eMap = {};
    const amtErr = validateMoney(payForm.amount, { required: true, min: 0.01, fieldName: "Amount" });
    if (amtErr) eMap.amount = amtErr;
    if (!payForm.accountId) eMap.accountId = "Select an account";
    const amountPaisa = toPaisa(payForm.amount);
    if (payParty && amountPaisa > payParty.balance) {
      eMap.amount = `Cannot exceed outstanding balance (${(payParty.balance / 100).toLocaleString()} Rs)`;
    }
    setErrors(eMap);
    if (Object.keys(eMap).length) return;
    const amount = amountPaisa;
    if (tab === "customers") {
      await api.customers.pay({ customerId: payForm.partyId, accountId: Number(payForm.accountId), amount });
    } else {
      await api.suppliers.pay({ supplierId: payForm.partyId, accountId: Number(payForm.accountId), amount });
    }
    setPayOpen(false);
    setPayParty(null);
    setErrors({});
    reload();
  };

  const addPurchaseItem = () => {
    const eMap = {};
    if (!productPick.productId) eMap.product = "Select a product";
    const qtyErr = validateQty(productPick.qty, { min: 0.01, fieldName: "Quantity" });
    if (qtyErr) eMap.qty = qtyErr;
    if (Object.keys(eMap).length) return setErrors((e) => ({ ...e, purchase: eMap }));
    const product = products?.find((p) => p.id === Number(productPick.productId));
    if (!product) return;
    setPurchaseForm({
      ...purchaseForm,
      items: [
        ...purchaseForm.items,
        { productId: product.id, name: product.name, qty: Number(productPick.qty), unitCost: product.cost_price },
      ],
    });
    setProductPick({ productId: "", qty: "1" });
    setErrors((e) => ({ ...e, purchase: {} }));
  };

  const submitPurchase = async (e) => {
    e.preventDefault();
    const eMap = {};
    if (validateSelect(purchaseForm.supplierId, "supplier")) eMap.supplierId = "Select a supplier";
    if (!purchaseForm.items.length) eMap.items = "Add at least one product";
    const paidErr = validateMoney(purchaseForm.paidAmount, { min: 0, fieldName: "Paid amount" });
    if (paidErr) eMap.paidAmount = paidErr;
    const paid = parseMoney(purchaseForm.paidAmount) || 0;
    const total = purchaseForm.items.reduce((s, i) => s + Math.round(i.unitCost * i.qty), 0) / 100;
    if (paid > total && total > 0) eMap.paidAmount = "Paid amount cannot exceed purchase total";
    if (paid > 0 && !purchaseForm.accountId) eMap.accountId = "Select account for payment";
    setErrors(eMap);
    if (Object.keys(eMap).length) return;
    await api.purchases.create({
      supplierId: Number(purchaseForm.supplierId),
      items: purchaseForm.items.map((i) => ({ productId: i.productId, qty: i.qty, unitCost: i.unitCost })),
      paidAmount: toPaisa(paid),
      accountId: paid > 0 ? Number(purchaseForm.accountId) : null,
    });
    setPurchaseOpen(false);
    setPurchaseForm({ supplierId: "", items: [], paidAmount: "", accountId: "" });
    setErrors({});
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
          <div className="toolbar">
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden p-0.5 bg-slate-50 dark:bg-slate-900/50">
              <button
                className={`px-4 h-9 text-sm rounded-lg font-medium transition-colors ${tab === "customers" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-700 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"}`}
                onClick={() => setTab("customers")}
              >
                Customers
              </button>
              <button
                className={`px-4 h-9 text-sm rounded-lg font-medium transition-colors ${tab === "suppliers" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-700 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"}`}
                onClick={() => setTab("suppliers")}
              >
                Suppliers
              </button>
            </div>
            <SearchInput className="w-52" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {tab === "suppliers" && (
              <button className="btn-secondary" onClick={() => setPurchaseOpen(true)}>Stock In</button>
            )}
            <button className="btn-primary" onClick={openNew}>
              Add {tab === "customers" ? "Customer" : "Supplier"}
            </button>
          </div>
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
        <form onSubmit={save} className="space-y-4">
          <FormField label="Name" required error={errors.name}>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" error={errors.name} maxLength={100} />
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03xx-xxxxxxx" error={errors.phone} maxLength={20} />
          </FormField>
          <FormField label="Notes">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" maxLength={500} />
          </FormField>
          <button type="submit" className="btn-primary w-full">Save</button>
        </form>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={tab === "customers" ? "Collect Udhar" : "Pay Supplier"}>
        <form onSubmit={submitPay} className="space-y-4">
          <FormField label="Amount" required error={errors.amount}>
            <MoneyInput required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} error={errors.amount} />
          </FormField>
          <FormField label={tab === "customers" ? "Deposit to Account" : "Pay from Account"} error={errors.accountId}>
            <Select value={payForm.accountId} onChange={(e) => setPayForm({ ...payForm, accountId: e.target.value })} error={errors.accountId}>
              <option value="">Select account</option>
              {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </FormField>
          <button type="submit" className="btn-primary w-full">Confirm Payment</button>
        </form>
      </Modal>

      <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title="Stock Purchase" wide>
        <form onSubmit={submitPurchase} className="space-y-4">
          <FormField label="Supplier" required error={errors.supplierId}>
            <Select required value={purchaseForm.supplierId} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })} error={errors.supplierId}>
              <option value="">Select supplier</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          {errors.items && <p className="field-error">{errors.items}</p>}
          <div className="flex gap-3 items-end">
            <FormField label="Product" className="flex-1" error={errors.purchase?.product}>
              <Select value={productPick.productId} onChange={(e) => setProductPick({ ...productPick, productId: e.target.value })}>
                <option value="">Select product</option>
                {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Qty" className="w-28" error={errors.purchase?.qty}>
              <QtyInput value={productPick.qty} onChange={(e) => setProductPick({ ...productPick, qty: e.target.value })} />
            </FormField>
            <button type="button" className="btn-secondary h-11 mb-0" onClick={addPurchaseItem}>Add</button>
          </div>
          {purchaseForm.items.length > 0 && (
            <ul className="text-sm space-y-1 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-3 border border-slate-200 dark:border-slate-700">
              {purchaseForm.items.map((i, idx) => (
                <li key={idx}>{i.name} × {i.qty}</li>
              ))}
            </ul>
          )}
          <FormField label="Paid Now" hint="Leave 0 for full credit from supplier" error={errors.paidAmount}>
            <MoneyInput value={purchaseForm.paidAmount} onChange={(e) => setPurchaseForm({ ...purchaseForm, paidAmount: e.target.value })} placeholder="0" error={errors.paidAmount} />
          </FormField>
          {parseMoney(purchaseForm.paidAmount) > 0 && (
            <FormField label="Pay From Account" error={errors.accountId}>
              <Select value={purchaseForm.accountId} onChange={(e) => setPurchaseForm({ ...purchaseForm, accountId: e.target.value })} error={errors.accountId}>
                <option value="">Select account</option>
                {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </FormField>
          )}
          <button type="submit" className="btn-primary w-full" disabled={!purchaseForm.items.length}>Record Purchase</button>
        </form>
      </Modal>
    </div>
  );
}
