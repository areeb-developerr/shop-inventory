const { getDb, getSetting, setSetting } = require("./index");

let lastSyncAt = null;
let syncing = false;

const SYNC_TABLES = [
  "products",
  "customers",
  "suppliers",
  "accounts",
  "invoices",
  "invoice_items",
  "purchases",
  "purchase_items",
  "ledger_entries",
  "daily_reports",
];

function status() {
  return {
    configured: Boolean(getSetting("supabaseUrl") && getSetting("supabaseKey")),
    lastSyncAt,
    syncing,
  };
}

function configure({ supabaseUrl, supabaseKey }) {
  if (supabaseUrl !== undefined) setSetting("supabaseUrl", supabaseUrl);
  if (supabaseKey !== undefined) setSetting("supabaseKey", supabaseKey);
  return status();
}

async function getClient() {
  const url = getSetting("supabaseUrl");
  const key = getSetting("supabaseKey");
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}

async function pushNow() {
  if (syncing) return status();
  const client = await getClient();
  if (!client) throw new Error("Supabase not configured. Add URL and key in Settings.");

  syncing = true;
  try {
    const db = getDb();

    for (const table of SYNC_TABLES) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      if (!rows.length) continue;
      const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`${table}: ${error.message}`);
    }

    const reports = db.prepare("SELECT * FROM daily_reports").all();
    for (const report of reports) {
      if (report.file_path) {
        const fs = require("fs");
        const path = require("path");
        if (fs.existsSync(report.file_path)) {
          const buf = fs.readFileSync(report.file_path);
          const fileName = path.basename(report.file_path);
          await client.storage.from("reports").upload(fileName, buf, { upsert: true, contentType: "text/html" });
        }
      }
      db.prepare("UPDATE daily_reports SET synced_at = datetime('now') WHERE id = ?").run(report.id);
    }

    lastSyncAt = new Date().toISOString();
    return { ...status(), lastSyncAt };
  } finally {
    syncing = false;
  }
}

let syncInterval = null;

function startAutoSync(intervalMs = 5 * 60 * 1000) {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (getSetting("supabaseUrl") && getSetting("supabaseKey")) {
      pushNow().catch(() => {});
    }
  }, intervalMs);
}

function stopAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = null;
}

module.exports = { status, configure, pushNow, startAutoSync, stopAutoSync };
