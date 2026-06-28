const { getDb, logSync } = require("../index");

function listCustomers({ search = "" } = {}) {
  const db = getDb();
  if (search) {
    const q = `%${search}%`;
    return db
      .prepare("SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name")
      .all(q, q);
  }
  return db.prepare("SELECT * FROM customers ORDER BY name").all();
}

function getCustomer(id) {
  return getDb().prepare("SELECT * FROM customers WHERE id = ?").get(id);
}

function createCustomer(data) {
  const result = getDb()
    .prepare("INSERT INTO customers (name, phone, notes) VALUES (?, ?, ?)")
    .run(data.name, data.phone || "", data.notes || "");
  logSync("customers", result.lastInsertRowid, "upsert");
  return getCustomer(result.lastInsertRowid);
}

function updateCustomer(id, data) {
  const existing = getCustomer(id);
  if (!existing) throw new Error("Customer not found");
  getDb()
    .prepare(
      "UPDATE customers SET name=?, phone=?, notes=?, updated_at=datetime('now') WHERE id=?"
    )
    .run(
      data.name ?? existing.name,
      data.phone ?? existing.phone,
      data.notes ?? existing.notes,
      id
    );
  logSync("customers", id, "upsert");
  return getCustomer(id);
}

function recordCustomerPayment({ customerId, accountId, amount, notes = "" }) {
  const db = getDb();
  return db.transaction(() => {
    if (amount <= 0) throw new Error("Amount must be positive");
    const customer = getCustomer(customerId);
    if (!customer) throw new Error("Customer not found");
    if (customer.balance < amount) throw new Error("Payment exceeds outstanding balance");
    const today = new Date().toISOString().slice(0, 10);
    db.prepare("UPDATE customers SET balance = balance - ?, updated_at=datetime('now') WHERE id = ?").run(
      amount,
      customerId
    );
    db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amount, accountId);
    const r = db
      .prepare(
        `INSERT INTO ledger_entries (date, type, account_id, party_type, party_id, amount, notes)
         VALUES (?, 'customer_payment', ?, 'customer', ?, ?, ?)`
      )
      .run(today, accountId, customerId, amount, notes || "Udhar collection");
    logSync("customers", customerId, "upsert");
    logSync("accounts", accountId, "upsert");
    logSync("ledger_entries", r.lastInsertRowid, "upsert");
    return getCustomer(customerId);
  })();
}

function listSuppliers({ search = "" } = {}) {
  const db = getDb();
  if (search) {
    const q = `%${search}%`;
    return db
      .prepare("SELECT * FROM suppliers WHERE name LIKE ? OR phone LIKE ? ORDER BY name")
      .all(q, q);
  }
  return db.prepare("SELECT * FROM suppliers ORDER BY name").all();
}

function getSupplier(id) {
  return getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
}

function createSupplier(data) {
  const result = getDb()
    .prepare("INSERT INTO suppliers (name, phone, notes) VALUES (?, ?, ?)")
    .run(data.name, data.phone || "", data.notes || "");
  logSync("suppliers", result.lastInsertRowid, "upsert");
  return getSupplier(result.lastInsertRowid);
}

function updateSupplier(id, data) {
  const existing = getSupplier(id);
  if (!existing) throw new Error("Supplier not found");
  getDb()
    .prepare(
      "UPDATE suppliers SET name=?, phone=?, notes=?, updated_at=datetime('now') WHERE id=?"
    )
    .run(
      data.name ?? existing.name,
      data.phone ?? existing.phone,
      data.notes ?? existing.notes,
      id
    );
  logSync("suppliers", id, "upsert");
  return getSupplier(id);
}

function recordSupplierPayment({ supplierId, accountId, amount, notes = "" }) {
  const db = getDb();
  return db.transaction(() => {
    if (amount <= 0) throw new Error("Amount must be positive");
    const supplier = getSupplier(supplierId);
    if (!supplier) throw new Error("Supplier not found");
    if (supplier.balance < amount) throw new Error("Payment exceeds outstanding balance");
    const today = new Date().toISOString().slice(0, 10);
    db.prepare("UPDATE suppliers SET balance = balance - ?, updated_at=datetime('now') WHERE id = ?").run(
      amount,
      supplierId
    );
    db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(amount, accountId);
    const r = db
      .prepare(
        `INSERT INTO ledger_entries (date, type, account_id, party_type, party_id, amount, notes)
         VALUES (?, 'supplier_payment', ?, 'supplier', ?, ?, ?)`
      )
      .run(today, accountId, supplierId, -amount, notes || "Supplier payment");
    logSync("suppliers", supplierId, "upsert");
    logSync("accounts", accountId, "upsert");
    logSync("ledger_entries", r.lastInsertRowid, "upsert");
    return getSupplier(supplierId);
  })();
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  recordCustomerPayment,
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  recordSupplierPayment,
};
