const { contextBridge, ipcRenderer } = require("electron");

async function invoke(channel, args) {
  const result = await ipcRenderer.invoke(channel, args);
  if (!result.ok) throw new Error(result.error || "Request failed");
  return result.data;
}

const api = {
  settings: {
    get: () => invoke("settings:get"),
    set: (data) => invoke("settings:set", data),
  },
  products: {
    list: (args) => invoke("products:list", args),
    get: (id) => invoke("products:get", { id }),
    create: (data) => invoke("products:create", data),
    update: (id, data) => invoke("products:update", { id, ...data }),
    delete: (id) => invoke("products:delete", { id }),
    lowStock: (threshold) => invoke("products:lowStock", { threshold }),
  },
  accounts: {
    list: () => invoke("accounts:list"),
    create: (data) => invoke("accounts:create", data),
    adjust: (id, amount, notes) => invoke("accounts:adjust", { id, amount, notes }),
    transfer: (data) => invoke("accounts:transfer", data),
  },
  customers: {
    list: (args) => invoke("customers:list", args),
    create: (data) => invoke("customers:create", data),
    update: (id, data) => invoke("customers:update", { id, ...data }),
    pay: (data) => invoke("customers:pay", data),
  },
  suppliers: {
    list: (args) => invoke("suppliers:list", args),
    create: (data) => invoke("suppliers:create", data),
    update: (id, data) => invoke("suppliers:update", { id, ...data }),
    pay: (data) => invoke("suppliers:pay", data),
  },
  sales: {
    create: (data) => invoke("sales:create", data),
  },
  invoices: {
    list: (args) => invoke("invoices:list", args),
    get: (id) => invoke("invoices:get", { id }),
  },
  purchases: {
    create: (data) => invoke("purchases:create", data),
    list: (args) => invoke("purchases:list", args),
    get: (id) => invoke("purchases:get", { id }),
  },
  dashboard: {
    summary: () => invoke("dashboard:summary"),
  },
  reports: {
    generate: (date) => invoke("reports:generate", { date }),
    list: () => invoke("reports:list"),
    get: (date) => invoke("reports:get", { date }),
    html: (date) => invoke("reports:html", { date }),
  },
  sync: {
    status: () => invoke("sync:status"),
    push: () => invoke("sync:push"),
  },
  db: {
    backup: () => invoke("db:backup"),
    path: () => invoke("db:path"),
  },
};

contextBridge.exposeInMainWorld("shopLedger", api);
