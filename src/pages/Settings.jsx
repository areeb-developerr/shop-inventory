import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { PageHeader, FormField, Input, Checkbox, QtyInput } from "../components/shared";
import { validateName, validateQty } from "../lib/validate";

function formatSchedule(times) {
  if (!times?.length) return "Not set";
  return times.join(", ");
}

function formatNext(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function Settings({ darkMode, setDarkMode }) {
  const [settings, setSettings] = useState({});
  const [syncStatus, setSyncStatus] = useState(null);
  const [msg, setMsg] = useState("");
  const [dbPath, setDbPath] = useState("");
  const [errors, setErrors] = useState({});

  const refreshSync = () => api.sync.status().then(setSyncStatus);

  useEffect(() => {
    api.settings.get().then(setSettings);
    refreshSync();
    api.db.path().then(setDbPath).catch(() => {});
    const interval = setInterval(refreshSync, 30000);
    return () => clearInterval(interval);
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const eMap = {};
    const nameErr = validateName(settings.storeName || "");
    if (nameErr) eMap.storeName = nameErr;
    const thresholdErr = validateQty(settings.lowStockThreshold, { min: 0, fieldName: "Low stock threshold", integer: true });
    if (thresholdErr) eMap.lowStockThreshold = thresholdErr;
    setErrors(eMap);
    if (Object.keys(eMap).length) return;
    await api.settings.set(settings);
    setErrors({});
    setMsg("Settings saved");
    setTimeout(() => setMsg(""), 2000);
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

        <div className="card p-6 space-y-3">
          <div>
            <h2 className="font-semibold text-base">Cloud Sync</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Credentials are read from <code className="text-xs bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">.env</code> only. Use the sync chip in the header to sync manually.
            </p>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
              <dt className="text-slate-500 text-xs">Status</dt>
              <dd className="font-medium mt-0.5">
                {syncStatus?.configured ? "Configured" : "Not configured"}
              </dd>
            </div>
            {syncStatus?.projectRef && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
                <dt className="text-slate-500 text-xs">Project</dt>
                <dd className="font-medium mt-0.5 font-mono text-xs">{syncStatus.projectRef}</dd>
              </div>
            )}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
              <dt className="text-slate-500 text-xs">Schedule</dt>
              <dd className="font-medium mt-0.5">{formatSchedule(syncStatus?.schedule)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
              <dt className="text-slate-500 text-xs">Next scheduled</dt>
              <dd className="font-medium mt-0.5">{formatNext(syncStatus?.nextScheduledAt)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
              <dt className="text-slate-500 text-xs">Last sync</dt>
              <dd className="font-medium mt-0.5">
                {syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : "Never"}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
              <dt className="text-slate-500 text-xs">Pending changes</dt>
              <dd className="font-medium mt-0.5">{syncStatus?.pendingCount ?? 0}</dd>
            </div>
          </dl>
          {syncStatus?.lastError && (
            <div className={`text-sm rounded-xl px-3 py-2 border ${
              syncStatus.lastErrorKind === "offline" || syncStatus.lastErrorKind === "timeout"
                ? "text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            }`}>
              <p>{syncStatus.lastError}</p>
              {(syncStatus.lastErrorKind === "offline" || syncStatus.lastErrorKind === "timeout") && (
                <p className="text-xs mt-1 opacity-80">
                  {syncStatus.pendingCount > 0
                    ? `${syncStatus.pendingCount} change(s) queued locally. Sync retries automatically when online (next attempt after a failed run, then at scheduled times).`
                    : "Sync will retry automatically when connection is restored."}
                </p>
              )}
            </div>
          )}
          {syncStatus?.configured && !syncStatus?.lastError && syncStatus?.pendingCount > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
              {syncStatus.pendingCount} change(s) waiting to upload. They sync on the next successful run (manual, scheduled, or after you save data).
            </p>
          )}
          <p className="text-xs text-slate-500">
            Add <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">SUPABASE_URI</code> and optional{" "}
            <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">SYNC_TIMES=13:00,18:00,21:00</code> to your project <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">.env</code>, then restart the app. See README for setup.
          </p>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-base">Data</h2>
          <p className="text-sm text-slate-500 break-all font-mono bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            {dbPath || "—"}
          </p>
          <button type="button" className="btn-secondary" onClick={backup}>Backup Database</button>
        </div>

        <button type="submit" className="btn-primary w-full sm:w-auto">Save Settings</button>
      </form>
    </div>
  );
}
