import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Users,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Items = lazy(() => import("./pages/Items.jsx"));
const NewSale = lazy(() => import("./pages/NewSale.jsx"));
const Invoices = lazy(() => import("./pages/Invoices.jsx"));
const People = lazy(() => import("./pages/People.jsx"));
const Accounts = lazy(() => import("./pages/Accounts.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "items", label: "Items", icon: Package },
  { id: "new-sale", label: "New Sale", icon: ShoppingCart },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "people", label: "People", icon: Users },
  { id: "accounts", label: "Accounts", icon: Wallet },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function formatAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function SyncChip({ status, onSync, syncing }) {
  if (!status) return null;

  if (!status.configured) {
    return (
      <div className="sync-chip-off" title="Set SUPABASE_URI in .env">
        <CloudOff className="w-3.5 h-3.5" />
        Sync off
      </div>
    );
  }

  const isOffline = status.lastErrorKind === "offline" || status.lastErrorKind === "timeout";
  const label = syncing || status.syncing
    ? "Syncing…"
    : status.lastError
      ? isOffline
        ? `Offline${status.pendingCount > 0 ? ` · ${status.pendingCount} pending` : ""}`
        : "Sync failed"
      : status.pendingCount > 0
        ? `${status.pendingCount} pending`
        : `Synced ${formatAgo(status.lastSyncAt) || "—"}`;

  if (status.syncing || syncing) {
    return (
      <div className="sync-chip-pending">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        {label}
      </div>
    );
  }

  if (status.lastError) {
    return (
      <button
        type="button"
        className={isOffline ? "sync-chip-pending" : "sync-chip-error"}
        onClick={onSync}
        disabled={syncing}
        title={status.lastError}
      >
        {isOffline ? <CloudOff className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
        {label} — tap to retry
      </button>
    );
  }

  if (status.pendingCount > 0) {
    return (
      <button type="button" className="sync-chip-pending" onClick={onSync} title="Click to sync now">
        <Cloud className="w-3.5 h-3.5" />
        {label}
      </button>
    );
  }

  return (
    <button type="button" className="sync-chip-ok" onClick={onSync} title="Click to sync now">
      <Cloud className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [storeName, setStoreName] = useState("Shop Ledger");
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch {
      return true;
    }
  });

  const refreshSync = () => {
    window.shopLedger?.sync.status().then(setSyncStatus);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (window.shopLedger) {
      window.shopLedger.settings.get().then((s) => {
        if (s.storeName) setStoreName(s.storeName);
      });
      refreshSync();
      const interval = setInterval(refreshSync, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleSync = async () => {
    if (!window.shopLedger || syncing) return;
    setSyncing(true);
    try {
      const result = await window.shopLedger.sync.push();
      setSyncStatus(result);
    } catch (err) {
      setSyncStatus((s) => ({ ...s, lastError: err.message }));
    } finally {
      setSyncing(false);
      refreshSync();
    }
  };

  const render = () => {
    const props = { setTab };
    switch (tab) {
      case "dashboard": return <Dashboard {...props} />;
      case "items": return <Items />;
      case "new-sale": return <NewSale {...props} />;
      case "invoices": return <Invoices />;
      case "people": return <People />;
      case "accounts": return <Accounts />;
      case "reports": return <Reports />;
      case "settings": return <SettingsPage darkMode={darkMode} setDarkMode={setDarkMode} />;
      default: return <Dashboard {...props} />;
    }
  };

  if (!window.shopLedger) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950">
        <div>
          <h1 className="text-xl font-bold mb-2">Shop Ledger</h1>
          <p className="text-slate-500">Run with <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">npm run dev</code> to start the Electron app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <aside className="w-60 shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center mr-2">
            <Package className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold truncate">{storeName}</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-end px-6 gap-3">
          <SyncChip status={syncStatus} onSync={handleSync} syncing={syncing} />
          <button
            type="button"
            onClick={() => {
              const next = !darkMode;
              setDarkMode(next);
              localStorage.setItem("theme", next ? "dark" : "light");
            }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>
        <main className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          <div className="max-w-6xl mx-auto">
            <Suspense fallback={<div className="text-slate-500">Loading…</div>}>
              {render()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
