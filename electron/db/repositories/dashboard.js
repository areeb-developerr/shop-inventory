const { getDb, getSetting } = require("../index");
const productsRepo = require("./products");

function summary() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const accounts = db.prepare("SELECT * FROM accounts ORDER BY is_default DESC").all();
  const cashTotal = accounts.filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0);
  const bankTotal = accounts.filter((a) => a.type === "bank").reduce((s, a) => s + a.balance, 0);

  const receivable = db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM customers").get().t;
  const payable = db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM suppliers").get().t;

  const todaySales = db
    .prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(subtotal), 0) as total,
       COALESCE(SUM(paid_amount), 0) as paid, COALESCE(SUM(due_amount), 0) as udhar
       FROM invoices WHERE date = ?`
    )
    .get(today);

  const threshold = Number(getSetting("lowStockThreshold", "5"));
  const lowStock = productsRepo.lowStock(threshold);

  const recentInvoices = db
    .prepare(
      `SELECT i.*, c.name as customer_name FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       ORDER BY i.created_at DESC LIMIT 5`
    )
    .all();

  return {
    accounts,
    cashTotal,
    bankTotal,
    moneyTotal: cashTotal + bankTotal,
    receivable,
    payable,
    todaySales,
    lowStock,
    lowStockCount: lowStock.length,
    recentInvoices,
    productCount: db.prepare("SELECT COUNT(*) as c FROM products").get().c,
  };
}

module.exports = { summary };
