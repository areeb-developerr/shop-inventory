const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const Database = require("better-sqlite3");

let db = null;

function getDbPath() {
  const userData = app.getPath("userData");
  const dir = path.join(userData, "ShopLedger");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "shop.db");
}

function initDb() {
  if (db) return db;
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = path.join(__dirname, "schema.sql");
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  migrateSyncLog();

  const accountCount = db.prepare("SELECT COUNT(*) as c FROM accounts").get().c;
  if (accountCount === 0) {
    db.prepare(
      "INSERT INTO accounts (name, type, balance, is_default) VALUES ('Cash Drawer', 'cash', 0, 1)"
    ).run();
  }

  const settingsCount = db.prepare("SELECT COUNT(*) as c FROM settings").get().c;
  if (settingsCount === 0) {
    const defaults = {
      storeName: "Shop Ledger",
      currency: "Rs",
      lowStockThreshold: "5",
      autoReportEnabled: "false",
      autoReportTime: "21:00",
    };
    const insert = db.prepare(
      "INSERT INTO settings (key, value) VALUES (@key, @value)"
    );
    for (const [key, value] of Object.entries(defaults)) {
      insert.run({ key, value });
    }
  }

  return db;
}

function getDb() {
  if (!db) return initDb();
  return db;
}

function getSetting(key, fallback = "") {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, String(value));
}

function getAllSettings() {
  const rows = getDb().prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function migrateSyncLog() {
  const cols = db.prepare("PRAGMA table_info(sync_log)").all();
  if (!cols.length) return;
  const syncedCol = cols.find((c) => c.name === "synced_at");
  if (syncedCol && syncedCol.notnull === 1) {
    db.exec(`
      CREATE TABLE sync_log_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        synced_at TEXT
      );
      INSERT INTO sync_log_new (id, table_name, record_id, action, synced_at)
        SELECT id, table_name, record_id, action, NULL FROM sync_log;
      DROP TABLE sync_log;
      ALTER TABLE sync_log_new RENAME TO sync_log;
    `);
  }
}

function logSync(tableName, recordId, action) {
  getDb()
    .prepare(
      "INSERT INTO sync_log (table_name, record_id, action, synced_at) VALUES (?, ?, ?, NULL)"
    )
    .run(tableName, recordId, action);
}

function nextInvoiceNo() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${today}-`;
  const last = getDb()
    .prepare("SELECT invoice_no FROM invoices WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`${prefix}%`);
  if (!last) return `${prefix}001`;
  const num = parseInt(last.invoice_no.slice(prefix.length), 10) + 1;
  return `${prefix}${String(num).padStart(3, "0")}`;
}

module.exports = {
  getDb,
  initDb,
  getDbPath,
  getSetting,
  setSetting,
  getAllSettings,
  logSync,
  nextInvoiceNo,
};
