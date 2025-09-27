import { api } from "./api";

let cachedSettings = null;
const listeners = new Set();

const defaultSettings = {
  storeName: "ShopFlow Store",
  storeAddress: "",
  storePhone: "",
  storeEmail: "",
  currency: "USD",
  taxRate: 0,
  theme: "light",
  language: "en",
  dateFormat: "MM/dd/yyyy",
  timeFormat: "12h",
  lowStockThreshold: 5,
  autoReorder: false,
  trackInventory: true,
  allowNegativeStock: false,
  lowStockAlerts: true,
  salesNotifications: true,
  emailReports: false,
  enableBackup: true,
  backupFrequency: "daily",
  requirePasswordForDelete: false,
  // Auth defaults
  authUsername: "tahir432",
  authPassword: "12345",
};

function emit() {
  for (const cb of listeners) cb(cachedSettings || defaultSettings);
  try {
    window.dispatchEvent(
      new CustomEvent("settings-changed", { detail: cachedSettings })
    );
  } catch (_) {}
}

export function getSettingsSync() {
  return cachedSettings || defaultSettings;
}

export async function loadSettings() {
  try {
    const s = await api.getSettings();
    cachedSettings = { ...defaultSettings, ...s };
    localStorage.setItem("shopflow-settings", JSON.stringify(cachedSettings));
  } catch (_) {
    try {
      const local = JSON.parse(
        localStorage.getItem("shopflow-settings") || "{}"
      );
      cachedSettings = { ...defaultSettings, ...local };
    } catch {
      cachedSettings = { ...defaultSettings };
    }
  }
  emit();
  return cachedSettings;
}

export async function saveSettings(updates) {
  const base = { ...getSettingsSync(), ...updates };
  const next = {
    ...base,
    taxRate: Number(base.taxRate) || 0,
    lowStockThreshold: Number(base.lowStockThreshold) || 5,
  };
  try {
    await api.updateSettings(next);
  } catch (_) {
    // keep local fallback
  }
  cachedSettings = next;
  localStorage.setItem("shopflow-settings", JSON.stringify(cachedSettings));
  emit();
  return cachedSettings;
}

export function subscribeSettings(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Helper function to get formatted currency
export function getCurrencyFormatter() {
  const settings = getSettingsSync();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: settings.currency || "USD",
  });
}

// Helper function to format currency
export function formatCurrency(amount) {
  return getCurrencyFormatter().format(Number(amount) || 0);
}

// Helper function to format date
export function formatDate(date, includeTime = false) {
  const settings = getSettingsSync();
  const d = new Date(date);

  if (includeTime) {
    return settings.timeFormat === "24h"
      ? d.toLocaleString("en-US", { hour12: false })
      : d.toLocaleString("en-US", { hour12: true });
  }

  return d.toLocaleDateString("en-US");
}

// Initialize settings on module load
loadSettings();
