const { getDb, logSync, nextInvoiceNo } = require("../index");

function listInvoices({ date, customerId, search, limit = 100 } = {}) {
  const db = getDb();
  let sql = `SELECT i.*, c.name as customer_name FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id WHERE 1=1`;
  const params = [];
  if (date) {
    sql += " AND i.date = ?";
    params.push(date);
  }
  if (customerId) {
    sql += " AND i.customer_id = ?";
    params.push(customerId);
  }
  if (search) {
    sql += " AND (i.invoice_no LIKE ? OR c.name LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q);
  }
  sql += " ORDER BY i.created_at DESC LIMIT ?";
  params.push(limit);
  return db.prepare(sql).all(...params);
}

function getInvoice(id) {
  const db = getDb();
  const invoice = db
    .prepare(
      `SELECT i.*, c.name as customer_name, c.phone as customer_phone
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id WHERE i.id = ?`
    )
    .get(id);
  if (!invoice) return null;
  invoice.items = db
    .prepare("SELECT * FROM invoice_items WHERE invoice_id = ?")
    .all(id);
  return invoice;
}

function createSale({ customerId, items, cashAmount = 0, bankAmount = 0, accountId, bankAccountId, notes = "" }) {
  const db = getDb();
  return db.transaction(() => {
    if (!items?.length) throw new Error("Add at least one item");

    let subtotal = 0;
    const lineItems = [];
    for (const item of items) {
      const product = db.prepare("SELECT * FROM products WHERE id = ?").get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      if (product.stock_qty < item.qty) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
      const unitPrice = item.unitPrice ?? product.sell_price;
      const lineTotal = Math.round(unitPrice * item.qty);
      subtotal += lineTotal;
      lineItems.push({ product, qty: item.qty, unitPrice, lineTotal });
    }

    const paidAmount = cashAmount + bankAmount;
    const dueAmount = subtotal - paidAmount;
    if (dueAmount < 0) throw new Error("Paid amount exceeds total");
    if (dueAmount > 0 && !customerId) throw new Error("Select a customer for udhar sales");
    if (cashAmount > 0) {
      if (!accountId) throw new Error("Select a cash account for this payment");
      const cashAccount = db.prepare("SELECT id, type FROM accounts WHERE id = ?").get(accountId);
      if (!cashAccount) throw new Error("Cash account not found");
      if (cashAccount.type !== "cash") throw new Error("Selected account is not a cash account");
    }
    if (bankAmount > 0) {
      if (!bankAccountId) throw new Error("Select a bank account for this payment");
      const bankAccount = db.prepare("SELECT id, type FROM accounts WHERE id = ?").get(bankAccountId);
      if (!bankAccount) throw new Error("Bank account not found");
      if (bankAccount.type !== "bank") throw new Error("Selected account is not a bank account");
    }

    let paymentType = "cash";
    if (dueAmount === subtotal) paymentType = "udhar";
    else if (dueAmount > 0) paymentType = "mixed";
    else if (bankAmount > 0 && cashAmount === 0) paymentType = "bank";
    else if (bankAmount > 0 && cashAmount > 0) paymentType = "mixed";

    const today = new Date().toISOString().slice(0, 10);
    const invoiceNo = nextInvoiceNo();
    const inv = db
      .prepare(
        `INSERT INTO invoices (invoice_no, customer_id, date, subtotal, paid_amount, due_amount, payment_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(invoiceNo, customerId || null, today, subtotal, paidAmount, dueAmount, paymentType, notes);
    const invoiceId = inv.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO invoice_items (invoice_id, product_id, name, qty, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const li of lineItems) {
      const itemRow = insertItem.run(invoiceId, li.product.id, li.product.name, li.qty, li.unitPrice, li.lineTotal);
      logSync("invoice_items", itemRow.lastInsertRowid, "upsert");
      db.prepare("UPDATE products SET stock_qty = stock_qty - ?, updated_at=datetime('now') WHERE id = ?").run(
        li.qty,
        li.product.id
      );
      logSync("products", li.product.id, "upsert");
    }

    if (cashAmount > 0 && accountId) {
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(cashAmount, accountId);
      const r = db
        .prepare(
          `INSERT INTO ledger_entries (date, type, account_id, amount, ref_type, ref_id, notes)
           VALUES (?, 'sale_payment', ?, ?, 'invoice', ?, ?)`
        )
        .run(today, accountId, cashAmount, invoiceId, `Sale ${invoiceNo} (cash)`);
      logSync("accounts", accountId, "upsert");
      logSync("ledger_entries", r.lastInsertRowid, "upsert");
    }
    if (bankAmount > 0 && bankAccountId) {
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(bankAmount, bankAccountId);
      const r = db
        .prepare(
          `INSERT INTO ledger_entries (date, type, account_id, amount, ref_type, ref_id, notes)
           VALUES (?, 'sale_payment', ?, ?, 'invoice', ?, ?)`
        )
        .run(today, bankAccountId, bankAmount, invoiceId, `Sale ${invoiceNo} (bank)`);
      logSync("accounts", bankAccountId, "upsert");
      logSync("ledger_entries", r.lastInsertRowid, "upsert");
    }
    if (dueAmount > 0) {
      db.prepare("UPDATE customers SET balance = balance + ?, updated_at=datetime('now') WHERE id = ?").run(
        dueAmount,
        customerId
      );
      logSync("customers", customerId, "upsert");
    }

    logSync("invoices", invoiceId, "upsert");
    return getInvoice(invoiceId);
  })();
}

function listPurchases({ limit = 50 } = {}) {
  return getDb()
    .prepare(
      `SELECT p.*, s.name as supplier_name FROM purchases p
       JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.created_at DESC LIMIT ?`
    )
    .all(limit);
}

function getPurchase(id) {
  const db = getDb();
  const purchase = db
    .prepare(
      `SELECT p.*, s.name as supplier_name FROM purchases p
       JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?`
    )
    .get(id);
  if (!purchase) return null;
  purchase.items = db.prepare("SELECT * FROM purchase_items WHERE purchase_id = ?").all(id);
  return purchase;
}

function createPurchase({ supplierId, items, paidAmount = 0, accountId, notes = "" }) {
  const db = getDb();
  return db.transaction(() => {
    if (!items?.length) throw new Error("Add at least one item");
    let total = 0;
    const lineItems = [];
    for (const item of items) {
      const product = db.prepare("SELECT * FROM products WHERE id = ?").get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const unitCost = item.unitCost ?? product.cost_price;
      const lineTotal = Math.round(unitCost * item.qty);
      total += lineTotal;
      lineItems.push({ product, qty: item.qty, unitCost, lineTotal });
    }

    const dueAmount = total - paidAmount;
    if (dueAmount < 0) throw new Error("Paid amount exceeds total");
    if (paidAmount > 0 && !accountId) throw new Error("Select account for payment");

    const today = new Date().toISOString().slice(0, 10);
    const pur = db
      .prepare(
        `INSERT INTO purchases (supplier_id, date, total, paid_amount, due_amount, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(supplierId, today, total, paidAmount, dueAmount, notes);
    const purchaseId = pur.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO purchase_items (purchase_id, product_id, name, qty, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const li of lineItems) {
      const itemRow = insertItem.run(purchaseId, li.product.id, li.product.name, li.qty, li.unitCost, li.lineTotal);
      logSync("purchase_items", itemRow.lastInsertRowid, "upsert");
      db.prepare(
        "UPDATE products SET stock_qty = stock_qty + ?, cost_price = ?, updated_at=datetime('now') WHERE id = ?"
      ).run(li.qty, li.unitCost, li.product.id);
      logSync("products", li.product.id, "upsert");
    }

    if (paidAmount > 0) {
      db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(paidAmount, accountId);
      const r = db
        .prepare(
          `INSERT INTO ledger_entries (date, type, account_id, party_type, party_id, amount, ref_type, ref_id, notes)
           VALUES (?, 'purchase_payment', ?, 'supplier', ?, ?, 'purchase', ?, ?)`
        )
        .run(today, accountId, supplierId, -paidAmount, purchaseId, "Stock purchase payment");
      logSync("accounts", accountId, "upsert");
      logSync("ledger_entries", r.lastInsertRowid, "upsert");
    }
    if (dueAmount > 0) {
      db.prepare("UPDATE suppliers SET balance = balance + ?, updated_at=datetime('now') WHERE id = ?").run(
        dueAmount,
        supplierId
      );
      logSync("suppliers", supplierId, "upsert");
    }

    logSync("purchases", purchaseId, "upsert");
    return getPurchase(purchaseId);
  })();
}

module.exports = {
  listInvoices,
  getInvoice,
  createSale,
  listPurchases,
  getPurchase,
  createPurchase,
};
