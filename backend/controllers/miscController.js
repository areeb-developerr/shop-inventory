const fs = require("fs");
const path = require("path");
const os = require("os");

const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Bill = require("../models/Bill");

function getDataDir() {
  const dir = path.join(os.homedir(), ".shop-inventory");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function settingsFile() {
  return path.join(getDataDir(), "settings.json");
}

exports.getSettings = async (_req, res, next) => {
  try {
    const file = settingsFile();
    if (!fs.existsSync(file)) {
      return res.json({ theme: "light", currency: "USD", lowStockThreshold: 5 });
    }
    const raw = fs.readFileSync(file, "utf-8");
    res.json(JSON.parse(raw));
  } catch (e) {
    next(e);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const data = req.body || {};
    fs.writeFileSync(settingsFile(), JSON.stringify(data, null, 2), "utf-8");
    res.json({ ok: true, settings: data });
  } catch (e) {
    next(e);
  }
};

// GET /api/search?q=...
exports.searchAll = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ products: [], customers: [], bills: [] });
    const regex = { $regex: q, $options: "i" };
    const [products, customers, bills] = await Promise.all([
      Product.find({ $or: [{ name: regex }, { sku: regex }, { category: regex }] })
        .limit(25)
        .lean(),
      Customer.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }] })
        .limit(25)
        .lean(),
      Bill.find({ "items.name": regex }).limit(25).lean(),
    ]);
    res.json({ products, customers, bills });
  } catch (e) {
    next(e);
  }
};

// GET /api/export/:type?format=json
exports.exportData = async (req, res, next) => {
  try {
    const { type } = req.params;
    let data = [];
    if (type === "products") data = await Product.find().lean();
    else if (type === "customers") data = await Customer.find().lean();
    else if (type === "bills") data = await Bill.find().lean();
    else return res.status(400).json({ error: "Unknown type" });

    res.json({ type, count: data.length, data });
  } catch (e) {
    next(e);
  }
};

// POST /api/import/:type { data }
exports.importData = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { data } = req.body || {};
    if (!Array.isArray(data)) return res.status(400).json({ error: "data must be array" });

    let result;
    if (type === "products") {
      result = await Product.insertMany(data, { ordered: false });
    } else if (type === "customers") {
      result = await Customer.insertMany(data, { ordered: false });
    } else if (type === "bills") {
      result = await Bill.insertMany(data, { ordered: false });
    } else {
      return res.status(400).json({ error: "Unknown type" });
    }
    res.json({ ok: true, inserted: result.length });
  } catch (e) {
    next(e);
  }
};

// GET /api/analytics
exports.analyticsOverview = async (_req, res, next) => {
  try {
    const [productCount, customerCount, billCount] = await Promise.all([
      Product.countDocuments(),
      Customer.countDocuments(),
      Bill.countDocuments(),
    ]);
    res.json({ productCount, customerCount, billCount, timestamp: new Date().toISOString() });
  } catch (e) {
    next(e);
  }
};



