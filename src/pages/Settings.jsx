import React, { useEffect, useMemo, useRef, useState } from "react";
import { Store, Palette, Bell, Shield, Package, Download, User, Lock } from "lucide-react";
import { isOnline } from "../services/offline";
import {
  getSettingsSync,
  loadSettings,
  saveSettings,
} from "../services/settings";

const NUMERIC_KEYS = new Set(["taxRate", "lowStockThreshold"]);

export default function Settings() {
  const [form, setForm] = useState(getSettingsSync());
  const [raw, setRaw] = useState(() => stringifiedNumeric(getSettingsSync()));
  const [status, setStatus] = useState("idle"); // idle | saving | saved | offline | editing
  const saveTimer = useRef(null);

  useEffect(() => {
    loadSettings().then((s) => {
      setForm(s);
      setRaw(stringifiedNumeric(s));
    });
  }, []);

  // Validation: block autosave when numeric fields are invalid or empty
  const hasInvalidNumbers = useMemo(() => {
    return ["taxRate", "lowStockThreshold"].some((k) => !isValidNumber(raw[k]));
  }, [raw]);

  // Debounced autosave
  useEffect(() => {
    if (!form) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // If user is editing invalid numeric, show editing and do not save yet
    if (hasInvalidNumbers) {
      setStatus("editing");
      return;
    }
    saveTimer.current = setTimeout(async () => {
      try {
        setStatus(isOnline() ? "saving" : "offline");
        await saveSettings(form);
        setStatus(isOnline() ? "saved" : "offline");
        setTimeout(() => setStatus("idle"), 1000);
      } catch {
        setStatus("idle");
      }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [form, hasInvalidNumbers]);

  const setField = (key) => (value) => {
    setRaw((prev) => ({ ...prev, [key]: value }));
    if (NUMERIC_KEYS.has(key)) {
      // Don't coerce while typing invalid; update only when valid
      if (isValidNumber(value)) {
        setForm((prev) => ({ ...prev, [key]: Number(value) }));
      } else {
        // Keep previous numeric value in form until valid input
        setStatus("editing");
      }
    } else {
      setForm((prev) => ({ ...prev, [key]: value }));
    }
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(form, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shopflow-settings.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold page-heading">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure store preferences and system behavior
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={status} />
          <button
            onClick={exportSettings}
            className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <Download className="h-4 w-4 mr-2" /> Export JSON
          </button>
        </div>
      </div>

      <Section title="Store Information" icon={Store}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Store Name"
            value={raw.storeName}
            disabled
            onChange={setField("storeName")}
          />
          <Input
            label="Store Email"
            type="email"
            value={raw.storeEmail}
            onChange={setField("storeEmail")}
          />
          <Input
            label="Store Phone"
            type="tel"
            value={raw.storePhone}
            onChange={setField("storePhone")}
          />
          <Select
            label="Currency"
            value={raw.currency}
            onChange={setField("currency")}
            options={[
              { value: "USD", label: "US Dollar ($)" },
              { value: "EUR", label: "Euro (€)" },
              { value: "GBP", label: "British Pound (£)" },
              { value: "CAD", label: "Canadian Dollar (C$)" },
              { value: "PKR", label: "Pakistani Rupee (₨)" },
            ]}
          />
          <div className="md:col-span-2">
            <Input
              label="Store Address"
              value={raw.storeAddress}
              onChange={setField("storeAddress")}
            />
          </div>
        </div>
      </Section>

      <Section title="Display" icon={Palette}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Language"
            value={raw.language}
            onChange={setField("language")}
            options={[
              { value: "en", label: "English" },
              { value: "es", label: "Spanish" },
              { value: "fr", label: "French" },
            ]}
          />
        </div>
      </Section>

      <Section title="Inventory" icon={Package}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Toggle
            label="Track Inventory"
            value={!!form.trackInventory}
            onChange={(v) => setField("trackInventory")(v)}
          />
          <Toggle
            label="Allow Negative Stock"
            value={!!form.allowNegativeStock}
            onChange={(v) => setField("allowNegativeStock")(v)}
          />
          <Input
            label="Low Stock Threshold"
            type="number"
            value={raw.lowStockThreshold}
            onChange={setField("lowStockThreshold")}
            hint={
              isValidNumber(raw.lowStockThreshold)
                ? undefined
                : "Enter a valid number"
            }
          />
        </div>
      </Section>

      <Section title="Notifications" icon={Bell}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Toggle
            label="Low Stock Alerts"
            value={!!form.lowStockAlerts}
            onChange={(v) => setField("lowStockAlerts")(v)}
          />
          <Toggle
            label="Sales Notifications"
            value={!!form.salesNotifications}
            onChange={(v) => setField("salesNotifications")(v)}
          />
        </div>
      </Section>

      <Section title="Security & Backup" icon={Shield}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Toggle
            label="Enable Automatic Backup"
            value={!!form.enableBackup}
            onChange={(v) => setField("enableBackup")(v)}
          />
          <Select
            label="Backup Frequency"
            value={raw.backupFrequency}
            onChange={setField("backupFrequency")}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
        </div>
      </Section>

      <Section title="Account" icon={User}>
        <AccountSection initial={form} onSaved={(next) => setForm(next)} />
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-4">
        <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
      {hint && <div className="text-xs text-red-600 mt-1">{hint}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-900 dark:text-white">{label}</div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function StatusPill({ status }) {
  if (status === "idle")
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Auto‑save on
      </div>
    );
  if (status === "saving")
    return (
      <div className="text-sm px-3 py-1 rounded-full border border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-900/20">
        Saving…
      </div>
    );
  if (status === "saved")
    return (
      <div className="text-sm px-3 py-1 rounded-full border border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20">
        All changes saved
      </div>
    );
  if (status === "offline")
    return (
      <div className="text-sm px-3 py-1 rounded-full border border-yellow-300 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20">
        Offline – will sync when online
      </div>
    );
  if (status === "editing")
    return (
      <div className="text-sm px-3 py-1 rounded-full border border-gray-300 text-gray-700 bg-gray-50 dark:bg-gray-800">
        Editing…
      </div>
    );
  return null;
}

function stringifiedNumeric(s) {
  const next = { ...s };
  for (const k of NUMERIC_KEYS) next[k] = String(next[k] ?? "");
  return next;
}

function isValidNumber(v) {
  if (v === undefined || v === null || v === "") return false;
  const n = Number(v);
  return Number.isFinite(n);
}

function AccountSection({ initial, onSaved }) {
  const [username, setUsername] = useState(initial.authUsername || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const { changeCredentials } = await import("../services/auth");
      const next = await changeCredentials({
        username,
        password: newPassword || undefined,
        currentPassword,
      });
      onSaved?.(next);
      setMessage("Account updated successfully");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setMessage(err.message || "Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2 text-sm text-gray-500 dark:text-gray-400">
        Default credentials are username: <code>tahir432</code>, password: <code>12345</code>
      </div>
      <Input label="Username" value={username} onChange={setUsername} />
      <div />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <div className="md:col-span-2 flex items-center gap-3">
        <button
          disabled={saving}
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {message && (
          <div className="text-sm text-gray-600 dark:text-gray-300">{message}</div>
        )}
      </div>
    </form>
  );
}
