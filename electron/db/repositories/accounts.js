const { getDb, logSync } = require("../index");

function list() {
  return getDb().prepare("SELECT * FROM accounts ORDER BY is_default DESC, name").all();
}

function getById(id) {
  return getDb().prepare("SELECT * FROM accounts WHERE id = ?").get(id);
}

function create({ name, type, balance = 0 }) {
  const db = getDb();
  if (type === "cash") {
    const existingCash = db.prepare("SELECT id FROM accounts WHERE type = 'cash' LIMIT 1").get();
    if (existingCash) throw new Error("Only one cash account is allowed. Add bank accounts for additional payment destinations.");
  }
  const result = db
    .prepare("INSERT INTO accounts (name, type, balance) VALUES (?, ?, ?)")
    .run(name, type, balance);
  logSync("accounts", result.lastInsertRowid, "upsert");
  return getById(result.lastInsertRowid);
}

function adjust(id, amount, notes = "Manual adjustment") {
  const db = getDb();
  return db.transaction(() => {
    const account = getById(id);
    if (!account) throw new Error("Account not found");
    db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amount, id);
    db.prepare(
      `INSERT INTO ledger_entries (date, type, account_id, amount, notes)
       VALUES (date('now'), 'adjustment', ?, ?, ?)`
    ).run(id, amount, notes);
    logSync("accounts", id, "upsert");
    const entryId = db.prepare("SELECT last_insert_rowid() as id").get().id;
    logSync("ledger_entries", entryId, "upsert");
    return getById(id);
  })();
}

function transfer(fromId, toId, amount, notes = "Transfer") {
  const db = getDb();
  return db.transaction(() => {
    if (amount <= 0) throw new Error("Amount must be positive");
    const from = getById(fromId);
    const to = getById(toId);
    if (!from || !to) throw new Error("Account not found");
    db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(amount, fromId);
    db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amount, toId);
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO ledger_entries (date, type, account_id, amount, notes, ref_type, ref_id)
       VALUES (?, 'transfer', ?, ?, ?, 'account', ?)`
    ).run(today, fromId, -amount, notes, toId);
    db.prepare(
      `INSERT INTO ledger_entries (date, type, account_id, amount, notes, ref_type, ref_id)
       VALUES (?, 'transfer', ?, ?, ?, 'account', ?)`
    ).run(today, toId, amount, notes, fromId);
    logSync("accounts", fromId, "upsert");
    logSync("accounts", toId, "upsert");
    return { from: getById(fromId), to: getById(toId) };
  })();
}

module.exports = { list, getById, create, adjust, transfer };
