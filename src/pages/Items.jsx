import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { toPaisa } from "../lib/format";
import { PageHeader, Money, Loading, ErrorBox, Modal, EmptyState } from "../components/shared";

const emptyForm = {
  name: "",
  category: "",
  unit: "pc",
  stock_qty: 0,
  cost_price: 0,
  sell_price: 0,
  supplier_id: "",
  low_stock_at: 5,
};

export default function Items() {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const { data: products, loading, error, reload } = useAsync(
    () => api.products.list({ search }),
    [search]
  );
  const { data: suppliers } = useAsync(() => api.suppliers.list(), []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({
      name: p.name,
      category: p.category || "",
      unit: p.unit || "pc",
      stock_qty: p.stock_qty,
      cost_price: p.cost_price / 100,
      sell_price: p.sell_price / 100,
      supplier_id: p.supplier_id || "",
      low_stock_at: p.low_stock_at ?? 5,
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      category: form.category,
      unit: form.unit,
      stock_qty: Number(form.stock_qty),
      cost_price: toPaisa(form.cost_price),
      sell_price: toPaisa(form.sell_price),
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
          <>
            <input
              className="input max-w-xs"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn-primary" onClick={openNew}>Add Item</button>
          </>
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
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div>
            <label className="label">Stock Qty</label>
            <input type="number" step="any" className="input" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
          </div>
          <div>
            <label className="label">Low Stock At</label>
            <input type="number" className="input" value={form.low_stock_at} onChange={(e) => setForm({ ...form, low_stock_at: e.target.value })} />
          </div>
          <div>
            <label className="label">Cost Price (Rs)</label>
            <input type="number" step="0.01" className="input" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
          </div>
          <div>
            <label className="label">Sell Price (Rs)</label>
            <input type="number" step="0.01" className="input" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Supplier</label>
            <select className="input" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">None</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
