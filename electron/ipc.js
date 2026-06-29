const { ipcMain, dialog } = require("electron");
const fs = require("fs");
const {
  initDb,
  getDbPath,
  getAllSettings,
  setSetting,
} = require("./db/index");
const products = require("./db/repositories/products");
const accounts = require("./db/repositories/accounts");
const people = require("./db/repositories/people");
const sales = require("./db/repositories/sales");
const dashboard = require("./db/repositories/dashboard");
const reports = require("./db/reports");
const sync = require("./db/sync");

const WRITE_CHANNELS = new Set([
  "products:create", "products:update", "products:delete",
  "accounts:create", "accounts:adjust", "accounts:transfer",
  "customers:create", "customers:update", "customers:pay",
  "suppliers:create", "suppliers:update", "suppliers:pay",
  "sales:create", "purchases:create",
  "reports:generate",
]);

function registerIpc() {
  initDb();

  const handle = (channel, fn) => {
    ipcMain.handle(channel, async (_event, args) => {
      try {
        const data = await fn(args);
        if (WRITE_CHANNELS.has(channel)) {
          sync.scheduleDebouncedPush();
        }
        return { ok: true, data };
      } catch (err) {
        return { ok: false, error: err.message || String(err) };
      }
    });
  };

  // Settings
  handle("settings:get", () => getAllSettings());
  handle("settings:set", (data) => {
    for (const [key, value] of Object.entries(data || {})) {
      setSetting(key, value);
    }
    return getAllSettings();
  });

  // Products
  handle("products:list", (args) => products.list(args));
  handle("products:get", ({ id }) => products.getById(id));
  handle("products:create", (data) => products.create(data));
  handle("products:update", ({ id, ...data }) => products.update(id, data));
  handle("products:delete", ({ id }) => products.remove(id));
  handle("products:lowStock", ({ threshold }) => products.lowStock(threshold));

  // Accounts
  handle("accounts:list", () => accounts.list());
  handle("accounts:create", (data) => accounts.create(data));
  handle("accounts:adjust", ({ id, amount, notes }) => accounts.adjust(id, amount, notes));
  handle("accounts:transfer", (data) => accounts.transfer(data.fromId, data.toId, data.amount, data.notes));

  // People
  handle("customers:list", (args) => people.listCustomers(args));
  handle("customers:create", (data) => people.createCustomer(data));
  handle("customers:update", ({ id, ...data }) => people.updateCustomer(id, data));
  handle("customers:pay", (data) => people.recordCustomerPayment(data));
  handle("suppliers:list", (args) => people.listSuppliers(args));
  handle("suppliers:create", (data) => people.createSupplier(data));
  handle("suppliers:update", ({ id, ...data }) => people.updateSupplier(id, data));
  handle("suppliers:pay", (data) => people.recordSupplierPayment(data));

  // Sales
  handle("sales:create", (data) => sales.createSale(data));
  handle("invoices:list", (args) => sales.listInvoices(args));
  handle("invoices:get", ({ id }) => sales.getInvoice(id));
  handle("purchases:create", (data) => sales.createPurchase(data));
  handle("purchases:list", (args) => sales.listPurchases(args));
  handle("purchases:get", ({ id }) => sales.getPurchase(id));

  // Dashboard
  handle("dashboard:summary", () => dashboard.summary());

  // Reports
  handle("reports:generate", ({ date }) => reports.generate(date));
  handle("reports:list", () => reports.list());
  handle("reports:get", ({ date }) => reports.getByDate(date));
  handle("reports:html", ({ date }) => reports.readHtml(date));

  // Sync
  handle("sync:status", () => sync.status());
  handle("sync:push", () => sync.pushNow());

  // DB backup
  handle("db:backup", async () => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Backup Database",
      defaultPath: `shop-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: "SQLite", extensions: ["db"] }],
    });
    if (canceled || !filePath) return { canceled: true };
    fs.copyFileSync(getDbPath(), filePath);
    return { canceled: false, filePath };
  });

  handle("db:path", () => getDbPath());
}

module.exports = { registerIpc };
