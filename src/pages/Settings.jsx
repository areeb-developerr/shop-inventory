import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { PageHeader, FormField, Input, Checkbox, QtyInput } from "../components/shared";
import { validateName, validateQty } from "../lib/validate";

export default function Settings({ darkMode, setDarkMode }) {
  const [settings, setSettings] = useState({});
  const [syncStatus, setSyncStatus] = useState(null);
  const [msg, setMsg] = useState("");
  const [dbPath, setDbPath] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.settings.get().then(setSettings);
    api.sync.status().then(setSyncStatus);
    api.db.path().then(setDbPath).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const eMap = {};
    const nameErr = validateName(settings.storeName || "");
    if (nameErr) eMap.storeName = nameErr;
    const thresholdErr = validateQty(settings.lowStockThreshold, { min: 0, fieldName: "Low stock threshold", integer: true });
    if (thresholdErr) eMap.lowStockThreshold = thresholdErr;
    if (settings.supabaseUrl?.trim() && !/^https?:\/\/.+/.test(settings.supabaseUrl.trim())) {
      eMap.supabaseUrl = "Enter a valid URL starting with http:// or https://";
    }
    setErrors(eMap);
    if (Object.keys(eMap).length) return;
    await api.settings.set(settings);
    setErrors({});
    setMsg("Settings saved");
    setTimeout(() => setMsg(""), 2000);
  };

  const syncNow = async () => {
    try {
      const result = await api.sync.push();
      setSyncStatus(result);
      setMsg("Sync complete");
    } catch (err) {
      setMsg(err.message);
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const backup = async () => {
    const result = await api.db.backup();
    if (!result.canceled) setMsg(`Backed up to ${result.filePath}`);
    setTimeout(() => setMsg(""), 4000);
  };

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <div>
      <PageHeader title="Settings" subtitle="Shop configuration, sync & backup" />
      {msg && (
        <div className="mb-4 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-2.5">
          {msg}
        </div>
      )}

      <form onSubmit={save} className="max-w-xl space-y-5">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-base">Shop</h2>
          <FormField label="Store Name" required error={errors.storeName}>
            <Input value={settings.storeName || ""} onChange={(e) => update("storeName", e.target.value)} placeholder="Your shop name" error={errors.storeName} maxLength={80} />
          </FormField>
          <FormField label="Currency Symbol">
            <Input value={settings.currency || "Rs"} onChange={(e) => update("currency", e.target.value)} placeholder="Rs" className="max-w-[120px]" maxLength={10} />
          </FormField>
          <FormField label="Low Stock Threshold" hint="Alert when stock falls to this level" error={errors.lowStockThreshold}>
            <QtyInput integer value={settings.lowStockThreshold || "5"} onChange={(e) => update("lowStockThreshold", e.target.value)} className="max-w-[120px]" error={errors.lowStockThreshold} />
          </FormField>
          <Checkbox
            label="Dark mode"
            checked={darkMode}
            onChange={(e) => {
              setDarkMode(e.target.checked);
              localStorage.setItem("theme", e.target.checked ? "dark" : "light");
            }}
          />
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-base">Auto Daily Report</h2>
          <Checkbox
            label="Generate automatically at end of day"
            checked={settings.autoReportEnabled === "true"}
            onChange={(e) => update("autoReportEnabled", e.target.checked ? "true" : "false")}
          />
          <FormField label="Report Time" hint="24-hour format, when app is open">
            <Input type="time" value={settings.autoReportTime || "21:00"} onChange={(e) => update("autoReportTime", e.target.value)} className="max-w-[160px]" />
          </FormField>
        </div>

        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-base">Cloud Sync</h2>
            <p className="text-sm text-slate-500 mt-1">Sync data for remote dashboard access from home.</p>
          </div>
          <FormField label="Supabase URL" error={errors.supabaseUrl}>
            <Input value={settings.supabaseUrl || ""} onChange={(e) => update("supabaseUrl", e.target.value)} placeholder="https://xxx.supabase.co" error={errors.supabaseUrl} />
          </FormField>
          <FormField label="Supabase Key">
            <Input type="password" value={settings.supabaseKey || ""} onChange={(e) => update("supabaseKey", e.target.value)} placeholder="Service role or anon key" />
          </FormField>
          {syncStatus && (
            <p className="text-sm text-slate-500">
              {syncStatus.configured ? `Last sync: ${syncStatus.lastSyncAt || "Never"}` : "Not configured"}
            </p>
          )}
          <button type="button" className="btn-secondary" onClick={syncNow}>Sync Now</button>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-base">Data</h2>
          <p className="text-sm text-slate-500 break-all font-mono bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            {dbPath || "—"}
          </p>
          <button type="button" className="btn-secondary" onClick={backup}>Backup Database</button>
        </div>

        <button type="submit" className="btn-primary w-full sm:w-auto">Save Settings</button>
      </form>
    </div>
  );
}
