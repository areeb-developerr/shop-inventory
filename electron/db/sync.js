const { Pool } = require("pg");
const dns = require("dns");
const { getDb, getSetting, setSetting } = require("./index");
const syncScheduler = require("./syncScheduler");
const { ensureCloudSchema } = require("./cloudSchema");

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

const CHILD_TABLES = {
  invoices: "invoice_items",
  purchases: "purchase_items",
};

const RETRY_DELAYS_MS = [60_000, 120_000, 300_000, 600_000, 900_000];

let pool = null;
let syncing = false;
let lastError = null;
let lastErrorKind = null;
let debounceTimer = null;
let retryTimer = null;
let retryAttempt = 0;

function getSupabaseUri() {
  return process.env.SUPABASE_URI || "";
}

function isConfigured() {
  return Boolean(getSupabaseUri());
}

function parseProjectRef(uri) {
  try {
    const url = new URL(uri.replace(/^postgres:/, "postgresql:"));
    const userMatch = url.username.match(/^postgres\.(.+)$/);
    if (userMatch) return userMatch[1];
    const host = url.hostname;
    const m = host.match(/^db\.([^.]+)\.supabase\.co$/);
    return m ? m[1] : host;
  } catch {
    return null;
  }
}

function classifySyncError(err) {
  const msg = err?.message || String(err);
  const code = err?.code || "";
  if (
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "ENETUNREACH" ||
    code === "ECONNREFUSED" ||
    /ENOTFOUND|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|getaddrinfo/i.test(msg)
  ) {
    return "offline";
  }
  if (code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) {
    return "timeout";
  }
  if (code === "28P01" || /password authentication failed/i.test(msg)) {
    return "auth";
  }
  if (/self signed certificate|SSL/i.test(msg)) {
    return "ssl";
  }
  if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
    return "schema";
  }
  return "other";
}

function friendlySyncError(err) {
  const kind = classifySyncError(err);
  const msg = err?.message || String(err);
  const uri = getSupabaseUri();

  if (
    (kind === "offline" || kind === "timeout") &&
    /db\.[^.]+\.supabase\.co/.test(uri)
  ) {
    return "Cannot reach Supabase. The direct host (db.*.supabase.co) is IPv6-only — many networks cannot use it. In Supabase → Project Settings → Database, copy the Session pooler URI (port 5432, host contains pooler.supabase.com) into SUPABASE_URI, restart the app, and try again. Your local data is safe.";
  }

  switch (kind) {
    case "offline":
      return "Cannot reach Supabase (no internet or project unreachable). Your shop data is safe locally — sync will retry automatically.";
    case "timeout":
      return "Connection timed out. Check your internet and try again.";
    case "auth":
      return "Database login failed. Check the password in SUPABASE_URI in .env.";
    case "ssl":
      return "Secure connection failed. Verify SUPABASE_URI is the Postgres URI from Supabase dashboard.";
    case "schema":
      return "Cloud database tables are missing. Restart the app and sync again — tables are created automatically on first sync. Or run supabase/schema.sql in the Supabase SQL Editor.";
    default:
      return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
  }
}

function resetPool() {
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
  }
}

function supabaseLookup(hostname, _options, callback) {
  if (/^db\.[^.]+\.supabase\.co$/.test(hostname)) {
    dns.resolve6(hostname, (err, addresses) => {
      if (!err && addresses?.length) {
        callback(null, addresses[0], 6);
        return;
      }
      dns.lookup(hostname, callback);
    });
    return;
  }
  dns.lookup(hostname, callback);
}

function parsePgConfig(uri) {
  const normalized = uri.replace(/^postgres:\/\//, "postgresql://");
  const url = new URL(normalized);
  return {
    host: url.hostname,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    lookup: supabaseLookup,
  };
}

function getPool() {
  if (!isConfigured()) return null;
  if (!pool) {
    pool = new Pool({
      ...parsePgConfig(getSupabaseUri()),
      max: 3,
    });
    pool.on("error", () => resetPool());
  }
  return pool;
}

function recordSyncFailure(err) {
  lastError = friendlySyncError(err);
  lastErrorKind = classifySyncError(err);
  setSetting("lastSyncError", lastError);
  setSetting("lastSyncErrorKind", lastErrorKind);
  setSetting("lastSyncAttemptAt", new Date().toISOString());
  if (lastErrorKind === "offline" || lastErrorKind === "timeout") {
    resetPool();
  }
}

function recordSyncSuccess() {
  lastError = null;
  lastErrorKind = null;
  retryAttempt = 0;
  setSetting("lastSyncError", "");
  setSetting("lastSyncErrorKind", "");
}

function hasPendingWork() {
  const db = getDb();
  try {
    const pendingLog = db.prepare("SELECT COUNT(*) as c FROM sync_log WHERE synced_at IS NULL").get().c;
    const pendingReports = db.prepare("SELECT COUNT(*) as c FROM daily_reports WHERE synced_at IS NULL").get().c;
    const initialDone = getSetting("syncInitialDone", "") === "true";
    return pendingLog > 0 || pendingReports > 0 || !initialDone;
  } catch {
    return true;
  }
}

function scheduleRetryPush() {
  if (!isConfigured() || retryTimer) return;
  if (!hasPendingWork()) return;
  if (retryAttempt >= RETRY_DELAYS_MS.length) return;

  const delay = RETRY_DELAYS_MS[retryAttempt];
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryAttempt += 1;
    pushNow({ background: true }).catch(() => {});
  }, delay);
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

async function upsertRow(client, tableName, row) {
  const cols = Object.keys(row);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const updates = cols.filter((c) => c !== "id").map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
  await client.query(
    `INSERT INTO ${tableName} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`,
    cols.map((c) => row[c])
  );
}

async function deleteRow(client, tableName, id) {
  await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
}

async function syncChildRows(client, parentTable, parentId) {
  const childTable = CHILD_TABLES[parentTable];
  if (!childTable) return;
  const fk = parentTable === "invoices" ? "invoice_id" : "purchase_id";
  const rows = getDb().prepare(`SELECT * FROM ${childTable} WHERE ${fk} = ?`).all(parentId);
  for (const row of rows) {
    await upsertRow(client, childTable, row);
  }
}

async function pushTableFull(client, tableName) {
  const rows = getDb().prepare(`SELECT * FROM ${tableName}`).all();
  for (const row of rows) {
    await upsertRow(client, tableName, row);
  }
}

async function processPending(client) {
  const db = getDb();
  const pending = db
    .prepare("SELECT * FROM sync_log WHERE synced_at IS NULL ORDER BY id")
    .all();

  const syncedLogIds = [];
  const processed = new Set();

  for (const entry of pending) {
    const key = `${entry.table_name}:${entry.record_id}:${entry.action}`;
    if (processed.has(key)) {
      syncedLogIds.push(entry.id);
      continue;
    }
    processed.add(key);

    if (entry.action === "delete") {
      await deleteRow(client, entry.table_name, entry.record_id);
    } else {
      const row = db
        .prepare(`SELECT * FROM ${entry.table_name} WHERE id = ?`)
        .get(entry.record_id);
      if (row) {
        await upsertRow(client, entry.table_name, row);
        if (CHILD_TABLES[entry.table_name]) {
          await syncChildRows(client, entry.table_name, entry.record_id);
        }
      }
    }
    syncedLogIds.push(entry.id);
  }

  if (syncedLogIds.length) {
    const now = new Date().toISOString();
    const mark = db.prepare("UPDATE sync_log SET synced_at = ? WHERE id = ?");
    for (const id of syncedLogIds) mark.run(now, id);
  }

  return syncedLogIds.length;
}

async function pushFull(client) {
  for (const table of SYNC_TABLES) {
    await pushTableFull(client, table);
  }
  setSetting("syncInitialDone", "true");
}

function status() {
  const db = getDb();
  let pendingCount = 0;
  try {
    pendingCount = db.prepare("SELECT COUNT(*) as c FROM sync_log WHERE synced_at IS NULL").get().c;
  } catch {
    pendingCount = 0;
  }

  const storedKind = getSetting("lastSyncErrorKind", "") || null;

  return {
    configured: isConfigured(),
    projectRef: parseProjectRef(getSupabaseUri() || ""),
    lastSyncAt: getSetting("lastSyncAt", "") || null,
    lastSyncAttemptAt: getSetting("lastSyncAttemptAt", "") || null,
    lastError: lastError || getSetting("lastSyncError", "") || null,
    lastErrorKind: lastErrorKind || storedKind,
    syncing,
    schedule: syncScheduler.getSchedule(),
    nextScheduledAt: syncScheduler.getNextScheduledAt(),
    pendingCount,
    retryScheduled: Boolean(retryTimer),
  };
}

async function pushNow({ background = false, fromScheduler = false } = {}) {
  if (syncing) return status();
  const client = getPool();
  if (!client) {
    const err = new Error("Cloud sync not configured. Set SUPABASE_URI in .env and restart the app.");
    if (!background) throw err;
    recordSyncFailure(err);
    return status();
  }

  syncing = true;
  setSetting("lastSyncAttemptAt", new Date().toISOString());

  try {
    const pgClient = await client.connect();
    try {
      await ensureCloudSchema(pgClient);

      const db = getDb();
      const initialDone = getSetting("syncInitialDone", "") === "true";

      if (!initialDone) {
        const hasData = SYNC_TABLES.some((t) => {
          try {
            return db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c > 0;
          } catch {
            return false;
          }
        });
        if (hasData) await pushFull(pgClient);
      }

      await processPending(pgClient);

      const reports = db.prepare("SELECT id FROM daily_reports WHERE synced_at IS NULL").all();
      const now = new Date().toISOString();
      for (const r of reports) {
        db.prepare("UPDATE daily_reports SET synced_at = ? WHERE id = ?").run(now, r.id);
      }

      const ts = new Date().toISOString();
      setSetting("lastSyncAt", ts);
      recordSyncSuccess();
      clearRetryTimer();

      if (fromScheduler) {
        syncScheduler.markScheduledSuccess();
      }

      return { ...status(), lastSyncAt: ts };
    } finally {
      pgClient.release();
    }
  } catch (err) {
    recordSyncFailure(err);
    scheduleRetryPush();
    if (!background) {
      throw new Error(friendlySyncError(err));
    }
    return status();
  } finally {
    syncing = false;
  }
}

function scheduleDebouncedPush(delayMs = 30000) {
  if (!isConfigured()) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    pushNow({ background: true }).catch(() => {});
  }, delayMs);
}

function startScheduler() {
  syncScheduler.start(() => pushNow({ background: true, fromScheduler: true }));
}

function stopScheduler() {
  syncScheduler.stop();
  clearRetryTimer();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  resetPool();
}

module.exports = {
  status,
  pushNow,
  scheduleDebouncedPush,
  startScheduler,
  stopScheduler,
  isConfigured,
  friendlySyncError,
};
