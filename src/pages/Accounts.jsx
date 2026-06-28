import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { toPaisa } from "../lib/format";
import { PageHeader, Money, Loading, ErrorBox, Modal } from "../components/shared";

export default function Accounts() {
  const { data: accounts, loading, error, reload } = useAsync(() => api.accounts.list(), []);
  const [open, setOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "cash", balance: 0 });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [transfer, setTransfer] = useState({ fromId: "", toId: "", amount: "" });
  const [msg, setMsg] = useState("");

  const create = async (e) => {
    e.preventDefault();
    await api.accounts.create({
      name: form.name,
      type: form.type,
      balance: toPaisa(form.balance),
    });
    setOpen(false);
    setForm({ name: "", type: "cash", balance: 0 });
    reload();
    setMsg("Account created");
    setTimeout(() => setMsg(""), 2000);
  };

  const adjust = async (e) => {
    e.preventDefault();
    await api.accounts.adjust(adjustOpen, toPaisa(adjustAmount), "Manual adjustment");
    setAdjustOpen(null);
    setAdjustAmount("");
    reload();
  };

  const doTransfer = async (e) => {
    e.preventDefault();
    await api.accounts.transfer({
      fromId: Number(transfer.fromId),
      toId: Number(transfer.toId),
      amount: toPaisa(transfer.amount),
    });
    setTransferOpen(false);
    setTransfer({ fromId: "", toId: "", amount: "" });
    reload();
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const total = accounts?.reduce((s, a) => s + a.balance, 0) || 0;

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle={`Total balance: ${(total / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).replace("PKR", "Rs")}`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setTransferOpen(true)}>Transfer</button>
            <button className="btn-primary" onClick={() => setOpen(true)}>Add Account</button>
          </>
        }
      />
      {msg && <div className="mb-4 text-sm text-emerald-600">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts?.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-slate-500 capitalize">{a.type}</p>
                <p className="font-semibold text-lg">{a.name}</p>
              </div>
              {a.is_default ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Default</span> : null}
            </div>
            <p className="text-2xl font-bold mt-3"><Money amount={a.balance} /></p>
            <button className="text-sm text-emerald-600 mt-3" onClick={() => setAdjustOpen(a.id)}>
              Adjust balance
            </button>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Account">
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </select>
          </div>
          <div>
            <label className="label">Opening Balance (Rs)</label>
            <input type="number" className="input" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">Create</button>
        </form>
      </Modal>

      <Modal open={!!adjustOpen} onClose={() => setAdjustOpen(null)} title="Adjust Balance">
        <form onSubmit={adjust} className="space-y-3">
          <p className="text-sm text-slate-500">Use positive to add, negative to subtract (Rs)</p>
          <input type="number" className="input" required value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
          <button type="submit" className="btn-primary w-full">Apply</button>
        </form>
      </Modal>

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer">
        <form onSubmit={doTransfer} className="space-y-3">
          <div>
            <label className="label">From</label>
            <select className="input" required value={transfer.fromId} onChange={(e) => setTransfer({ ...transfer, fromId: e.target.value })}>
              <option value="">Select</option>
              {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To</label>
            <select className="input" required value={transfer.toId} onChange={(e) => setTransfer({ ...transfer, toId: e.target.value })}>
              <option value="">Select</option>
              {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount (Rs)</label>
            <input type="number" className="input" required value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">Transfer</button>
        </form>
      </Modal>
    </div>
  );
}
