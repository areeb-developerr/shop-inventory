import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { toPaisa } from "../lib/format";
import { PageHeader, Money, Loading, ErrorBox, Modal, EmptyState, FormField, Input, Select, MoneyInput, QtyInput, SearchInput } from "../components/shared";
import { validateName, validateMoney, validateQty } from "../lib/validate";

const emptyForm = {
  name: "",
  category: "",
  unit: "pc",
  stock_qty: "0",
  cost_price: "",
  sell_price: "",
  supplier_id: "",
  low_stock_at: "5",
};

export default function Items() {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState({});

  const { data: products, loading, error, reload } = useAsync(
    () => api.products.list({ search }),
    [search]
  );
  const { data: suppliers } = useAsync(() => api.suppliers.list(), []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({
      name: p.name,
      category: p.category || "",
      unit: p.unit || "pc",
      stock_qty: String(p.stock_qty),
      cost_price: String(p.cost_price / 100),
      sell_price: String(p.sell_price / 100),
      supplier_id: p.supplier_id || "",
      low_stock_at: String(p.low_stock_at ?? 5),
    });
    setErrors({});
    setOpen(true);
  };

  const validate = () => {
    const e = {};
    const nameErr = validateName(form.name);
    if (nameErr) e.name = nameErr;
    const stockErr = validateQty(form.stock_qty, { min: 0, fieldName: "Stock quantity" });
    if (stockErr) e.stock_qty = stockErr;
    const lowErr = validateQty(form.low_stock_at, { min: 0, fieldName: "Low stock alert" });
    if (lowErr) e.low_stock_at = lowErr;
    const costErr = validateMoney(form.cost_price, { min: 0, fieldName: "Cost price" });
    if (costErr) e.cost_price = costErr;
    const sellErr = validateMoney(form.sell_price, { min: 0, fieldName: "Sell price" });
    if (sellErr) e.sell_price = sellErr;
    const cost = parseFloat(form.cost_price) || 0;
    const sell = parseFloat(form.sell_price) || 0;
    if (!e.sell_price && !e.cost_price && sell > 0 && sell < cost) {
      e.sell_price = "Sell price should not be less than cost price";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit.trim() || "pc",
      stock_qty: Number(form.stock_qty),
      cost_price: toPaisa(form.cost_price || 0),
      sell_price: toPaisa(form.sell_price || 0),
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      low_stock_at: Number(form.low_stock_at),
    };
    if (editing) await api.products.update(editing, payload);
    else await api.products.create(payload);
    setOpen(false);
    setMsg(editing ? "Item updated" : "Item added");
    reload();
    setTimeout(() => setMsg(""), 3000);
  };

  const remove = async (id) => {
    if (!confirm("Delete this item?")) return;
    await api.products.delete(id);
    reload();
  };

  if (loading && !products) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Items"
        subtitle={`${products?.length || 0} products in catalog`}
        actions={
          <div className="toolbar">
            <SearchInput
              className="w-56"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn-primary" onClick={openNew}>Add Item</button>
          </div>
        }
      />
      {msg && <div className="mb-4 text-sm text-emerald-600">{msg}</div>}

      {!products?.length ? (
        <EmptyState message="No items yet. Add your first product." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Cost</th>
                <th>Sell</th>
                <th>Supplier</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.category || "—"}</td>
                  <td className={p.stock_qty <= (p.low_stock_at ?? 5) ? "text-red-500 font-medium" : ""}>
                    {p.stock_qty} {p.unit}
                  </td>
                  <td><Money amount={p.cost_price} /></td>
                  <td><Money amount={p.sell_price} /></td>
                  <td>{p.supplier_name || "—"}</td>
                  <td className="text-right space-x-2">
                    <button className="text-sm text-emerald-600" onClick={() => openEdit(p)}>Edit</button>
                    <button className="text-sm text-red-500" onClick={() => remove(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Item" : "Add Item"} wide>
        <form onSubmit={save} className="form-grid">
          <FormField label="Name" required error={errors.name} className="sm:col-span-2">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" error={errors.name} maxLength={120} />
          </FormField>
          <FormField label="Category">
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Insecticide" maxLength={60} />
          </FormField>
          <FormField label="Unit">
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pc, L, kg" maxLength={20} />
          </FormField>
          <FormField label="Stock Qty" error={errors.stock_qty}>
            <QtyInput value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} error={errors.stock_qty} />
          </FormField>
          <FormField label="Low Stock Alert At" error={errors.low_stock_at}>
            <QtyInput value={form.low_stock_at} onChange={(e) => setForm({ ...form, low_stock_at: e.target.value })} error={errors.low_stock_at} />
          </FormField>
          <FormField label="Cost Price" error={errors.cost_price}>
            <MoneyInput value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} placeholder="0" error={errors.cost_price} />
          </FormField>
          <FormField label="Sell Price" error={errors.sell_price}>
            <MoneyInput value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} placeholder="0" error={errors.sell_price} />
          </FormField>
          <FormField label="Supplier" className="sm:col-span-2">
            <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">None</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <div className="sm:col-span-2 form-actions">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Item</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
