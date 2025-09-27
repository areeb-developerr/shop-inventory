// controllers/productController.js
const Product = require("../models/Product");

// GET /api/products?q=search
exports.list = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { sku: { $regex: q, $options: "i" } },
            { category: { $regex: q, $options: "i" } },
          ],
        }
      : {};
    const items = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .limit(1000)
      .lean();
    res.json(items);
  } catch (e) {
    next(e);
  }
};

// GET /api/products/:id
exports.getOne = async (req, res, next) => {
  try {
    const doc = await Product.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

// POST /api/products
exports.create = async (req, res, next) => {
  try {
    const p = new Product(req.body);
    await p.save();
    res.json(p);
  } catch (e) {
    next(e);
  }
};

// PUT /api/products/:id
exports.update = async (req, res, next) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  } catch (e) {
    next(e);
  }
};

// DELETE /api/products/:id
exports.remove = async (req, res, next) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

// GET /api/products/low-stock?threshold=5
exports.lowStock = async (req, res, next) => {
  try {
    const threshold = Number(req.query.threshold || 5);
    const items = await Product.find({ quantity: { $lte: threshold } })
      .sort({ quantity: 1 })
      .lean();
    res.json(items);
  } catch (e) {
    next(e);
  }
};

// PATCH /api/products/:id/stock { quantity, type } where type in [set, increment, decrement]
exports.updateStock = async (req, res, next) => {
  try {
    const { quantity, type = "set" } = req.body || {};
    if (quantity === undefined || quantity === null)
      return res.status(400).json({ error: "quantity is required" });

    let update;
    const q = Number(quantity);
    if (type === "increment") update = { $inc: { quantity: q } };
    else if (type === "decrement") update = { $inc: { quantity: -q } };
    else update = { $set: { quantity: Math.max(0, q) } };

    const doc = await Product.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

// PATCH /api/products/bulk { updates: [{ _id, ...fields }] }
exports.bulkUpdate = async (req, res, next) => {
  try {
    const { updates } = req.body || {};
    if (!Array.isArray(updates) || updates.length === 0)
      return res.status(400).json({ error: "updates array required" });

    const ops = updates.map((u) => ({
      updateOne: { filter: { _id: u._id }, update: { $set: { ...u, _id: undefined } } },
    }));
    const result = await Product.bulkWrite(ops);
    res.json({ ok: true, result });
  } catch (e) {
    next(e);
  }
};

// DELETE /api/products/bulk { ids: [id] }
exports.bulkDelete = async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "ids array required" });
    const result = await Product.deleteMany({ _id: { $in: ids } });
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (e) {
    next(e);
  }
};