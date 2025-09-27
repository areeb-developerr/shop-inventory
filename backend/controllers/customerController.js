// controllers/customerController.js
const Customer = require("../models/Customer");

// GET /api/customers?q=...
exports.list = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { phone: { $regex: q, $options: "i" } },
          ],
        }
      : {};
    const customers = await Customer.find(filter)
      .sort({ updatedAt: -1 })
      .limit(1000)
      .lean();
    res.json(customers);
  } catch (e) {
    next(e);
  }
};

// POST /api/customers
exports.create = async (req, res, next) => {
  try {
    const c = new Customer(req.body);
    await c.save();
    res.json(c);
  } catch (e) {
    next(e);
  }
};

// PUT /api/customers/:id
exports.update = async (req, res, next) => {
  try {
    const c = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json(c);
  } catch (e) {
    next(e);
  }
};

// GET /api/customers/:id (optional)
exports.getOne = async (req, res, next) => {
  try {
    const c = await Customer.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json(c);
  } catch (e) {
    next(e);
  }
};

// DELETE /api/customers/:id (not used in UI but handy)
exports.remove = async (req, res, next) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
