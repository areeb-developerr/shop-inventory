import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { PageHeader } from "../components/shared";

export default function Settings({ darkMode, setDarkMode }) {
  const [settings, setSettings] = useState({});
  const [syncStatus, setSyncStatus] = useState(null);
  const [msg, setMsg] = useState("");
  const [dbPath, setDbPath] = useState("");

  useEffect(() => {
    api.settings.get().then(setSettings);
    api.sync.status().then(setSyncStatus);
    api.db.path().then(setDbPath).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    await api.settings.set(settings);
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
      {msg && <div className="mb-4 text-sm text-emerald-600">{msg}</div>}

      <form onSubmit={save} className="max-w-xl space-y-6">
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Shop</h2>
          <div>
            <label className="label">Store Name</label>
            <input className="input" value={settings.storeName || ""} onChange={(e) => update("storeName", e.target.value)} />
          </div>
          <div>
            <label className="label">Currency Symbol</label>
            <input className="input" value={settings.currency || "Rs"} onChange={(e) => update("currency", e.target.value)} />
          </div>
          <div>
            <label className="label">Low Stock Threshold</label>
            <input type="number" className="input" value={settings.lowStockThreshold || "5"} onChange={(e) => update("lowStockThreshold", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={darkMode} onChange={(e) => {
              setDarkMode(e.target.checked);
              localStorage.setItem("theme", e.target.checked ? "dark" : "light");
            }} />
            Dark mode
          </label>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Auto Daily Report</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.autoReportEnabled === "true"}
              onChange={(e) => update("autoReportEnabled", e.target.checked ? "true" : "false")}
            />
            Generate automatically at end of day
          </label>
          <div>
            <label className="label">Time (24h)</label>
            <input type="time" className="input" value={settings.autoReportTime || "21:00"} onChange={(e) => update("autoReportTime", e.target.value)} />
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Cloud Sync (Supabase)</h2>
          <p className="text-sm text-slate-500">Sync data for remote dashboard access from home.</p>
          <div>
            <label className="label">Supabase URL</label>
            <input className="input" value={settings.supabaseUrl || ""} onChange={(e) => update("supabaseUrl", e.target.value)} placeholder="https://xxx.supabase.co" />
          </div>
          <div>
            <label className="label">Supabase Key</label>
            <input type="password" className="input" value={settings.supabaseKey || ""} onChange={(e) => update("supabaseKey", e.target.value)} />
          </div>
          {syncStatus && (
            <p className="text-sm text-slate-500">
              {syncStatus.configured ? `Last sync: ${syncStatus.lastSyncAt || "Never"}` : "Not configured"}
            </p>
          )}
          <button type="button" className="btn-secondary" onClick={syncNow}>Sync Now</button>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Data</h2>
          <p className="text-sm text-slate-500 break-all">Database: {dbPath}</p>
          <button type="button" className="btn-secondary" onClick={backup}>Backup Database</button>
        </div>

        <button type="submit" className="btn-primary">Save Settings</button>
      </form>
    </div>
  );
}
