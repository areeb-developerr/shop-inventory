const { getDb, logSync } = require("../index");

function list({ search = "" } = {}) {
  const db = getDb();
  if (search) {
    const q = `%${search}%`;
    return db
      .prepare(
        `SELECT p.*, s.name as supplier_name FROM products p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.name LIKE ? OR p.category LIKE ?
         ORDER BY p.name`
      )
      .all(q, q);
  }
  return db
    .prepare(
      `SELECT p.*, s.name as supplier_name FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       ORDER BY p.name`
    )
    .all();
}

function getById(id) {
  return getDb()
    .prepare(
      `SELECT p.*, s.name as supplier_name FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?`
    )
    .get(id);
}

function create(data) {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO products (name, category, unit, stock_qty, cost_price, sell_price, supplier_id, low_stock_at)
       VALUES (@name, @category, @unit, @stock_qty, @cost_price, @sell_price, @supplier_id, @low_stock_at)`
    )
    .run({
      name: data.name,
      category: data.category || "",
      unit: data.unit || "pc",
      stock_qty: data.stock_qty ?? 0,
      cost_price: data.cost_price ?? 0,
      sell_price: data.sell_price ?? 0,
      supplier_id: data.supplier_id || null,
      low_stock_at: data.low_stock_at ?? 5,
    });
  logSync("products", result.lastInsertRowid, "upsert");
  return getById(result.lastInsertRowid);
}

function update(id, data) {
  const db = getDb();
  const existing = getById(id);
  if (!existing) throw new Error("Product not found");
  db.prepare(
    `UPDATE products SET name=@name, category=@category, unit=@unit, stock_qty=@stock_qty,
     cost_price=@cost_price, sell_price=@sell_price, supplier_id=@supplier_id,
     low_stock_at=@low_stock_at, updated_at=datetime('now') WHERE id=@id`
  ).run({
    id,
    name: data.name ?? existing.name,
    category: data.category ?? existing.category,
    unit: data.unit ?? existing.unit,
    stock_qty: data.stock_qty ?? existing.stock_qty,
    cost_price: data.cost_price ?? existing.cost_price,
    sell_price: data.sell_price ?? existing.sell_price,
    supplier_id: data.supplier_id !== undefined ? data.supplier_id : existing.supplier_id,
    low_stock_at: data.low_stock_at ?? existing.low_stock_at,
  });
  logSync("products", id, "upsert");
  return getById(id);
}

function remove(id) {
  getDb().prepare("DELETE FROM products WHERE id = ?").run(id);
  logSync("products", id, "delete");
  return { ok: true };
}

function lowStock(threshold) {
  return getDb()
    .prepare(
      `SELECT p.*, s.name as supplier_name FROM products p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.stock_qty <= COALESCE(p.low_stock_at, ?) ORDER BY p.stock_qty`
    )
    .all(threshold);
}

module.exports = { list, getById, create, update, remove, lowStock };
