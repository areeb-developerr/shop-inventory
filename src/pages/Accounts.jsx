import { useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { toPaisa } from "../lib/format";
import { PageHeader, Money, Loading, ErrorBox, Modal, FormField, Input, SelectMenu, MoneyInput } from "../components/shared";
import { validateName, validateMoney, validateSelect } from "../lib/validate";

export default function Accounts() {
  const { data: accounts, loading, error, reload } = useAsync(() => api.accounts.list(), []);
  const [open, setOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "cash", balance: "" });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [transfer, setTransfer] = useState({ fromId: "", toId: "", amount: "" });
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState({});

  const create = async (e) => {
    e.preventDefault();
    const eMap = {};
    const nameErr = validateName(form.name);
    if (nameErr) eMap.name = nameErr;
    const balErr = validateMoney(form.balance, { min: 0, fieldName: "Opening balance" });
    if (balErr) eMap.balance = balErr;
    setErrors(eMap);
    if (Object.keys(eMap).length) return;
    await api.accounts.create({
      name: form.name.trim(),
      type: form.type,
      balance: toPaisa(form.balance || 0),
    });
    setOpen(false);
    setForm({ name: "", type: "cash", balance: "" });
    setErrors({});
    reload();
    setMsg("Account created");
    setTimeout(() => setMsg(""), 2000);
  };

  const adjust = async (e) => {
    e.preventDefault();
    const balErr = validateMoney(adjustAmount, { required: true, allowNegative: true, fieldName: "Adjustment" });
    if (balErr) return setErrors({ adjust: balErr });
    if (parseFloat(adjustAmount) === 0) return setErrors({ adjust: "Adjustment cannot be zero" });
    setErrors({});
    await api.accounts.adjust(adjustOpen, toPaisa(adjustAmount), "Manual adjustment");
    setAdjustOpen(null);
    setAdjustAmount("");
    reload();
  };

  const doTransfer = async (e) => {
    e.preventDefault();
    const eMap = {};
    if (validateSelect(transfer.fromId, "source account")) eMap.fromId = "Select source account";
    if (validateSelect(transfer.toId, "destination account")) eMap.toId = "Select destination account";
    if (transfer.fromId && transfer.toId && transfer.fromId === transfer.toId) {
      eMap.toId = "Source and destination must be different";
    }
    const amtErr = validateMoney(transfer.amount, { required: true, min: 0.01, fieldName: "Transfer amount" });
    if (amtErr) eMap.amount = amtErr;
    setErrors(eMap);
    if (Object.keys(eMap).length) return;
    await api.accounts.transfer({
      fromId: Number(transfer.fromId),
      toId: Number(transfer.toId),
      amount: toPaisa(transfer.amount),
    });
    setTransferOpen(false);
    setTransfer({ fromId: "", toId: "", amount: "" });
    setErrors({});
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
          <div className="toolbar">
            <button className="btn-secondary" onClick={() => setTransferOpen(true)}>Transfer</button>
            <button className="btn-primary" onClick={() => setOpen(true)}>Add Account</button>
          </div>
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
        <form onSubmit={create} className="space-y-4">
          <FormField label="Account Name" required error={errors.name}>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cash Drawer, HBL" error={errors.name} maxLength={80} />
          </FormField>
          <FormField label="Type">
            <SelectMenu
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v })}
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank", label: "Bank" },
              ]}
            />
          </FormField>
          <FormField label="Opening Balance" hint="Current balance when creating this account" error={errors.balance}>
            <MoneyInput value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} placeholder="0" error={errors.balance} />
          </FormField>
          <button type="submit" className="btn-primary w-full">Create Account</button>
        </form>
      </Modal>

      <Modal open={!!adjustOpen} onClose={() => setAdjustOpen(null)} title="Adjust Balance">
        <form onSubmit={adjust} className="space-y-4">
          <FormField label="Adjustment Amount" hint="Positive to add, negative to subtract" error={errors.adjust}>
            <MoneyInput required value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="0" error={errors.adjust} allowNegative />
          </FormField>
          <button type="submit" className="btn-primary w-full">Apply Adjustment</button>
        </form>
      </Modal>

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer Funds">
        <form onSubmit={doTransfer} className="space-y-4">
          <FormField label="From Account" required error={errors.fromId}>
            <SelectMenu
              value={transfer.fromId}
              onChange={(v) => setTransfer({ ...transfer, fromId: v })}
              error={errors.fromId}
              placeholder="Select account"
              options={[
                { value: "", label: "Select account" },
                ...(accounts?.map((a) => ({ value: String(a.id), label: a.name })) || []),
              ]}
            />
          </FormField>
          <FormField label="To Account" required error={errors.toId}>
            <SelectMenu
              value={transfer.toId}
              onChange={(v) => setTransfer({ ...transfer, toId: v })}
              error={errors.toId}
              placeholder="Select account"
              options={[
                { value: "", label: "Select account" },
                ...(accounts?.map((a) => ({ value: String(a.id), label: a.name })) || []),
              ]}
            />
          </FormField>
          <FormField label="Amount" required error={errors.amount}>
            <MoneyInput required value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} placeholder="0" error={errors.amount} />
          </FormField>
          <button type="submit" className="btn-primary w-full">Transfer</button>
        </form>
      </Modal>
    </div>
  );
}
