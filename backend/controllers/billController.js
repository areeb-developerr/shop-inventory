// controllers/billController.js
const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const Product = require("../models/Product");

// GET /api/bills
// Optional filters: ?start=YYYY-MM-DD&end=YYYY-MM-DD
exports.list = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const filter = {};
    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = new Date(start);
      if (end) filter.date.$lte = new Date(end);
    }
    const bills = await Bill.find(filter).sort({ date: -1 }).limit(200).lean();
    res.json(bills);
  } catch (e) {
    next(e);
  }
};

// GET /api/bills/:id
exports.getOne = async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id).lean();
    if (!bill) return res.status(404).json({ error: "Not found" });
    res.json(bill);
  } catch (e) {
    next(e);
  }
};

// POST /api/bills
// Body: { customerName, items: [{productId, quantity, sellingPrice}], notes }
exports.create = async (req, res, next) => {
  const { customerName = "Walk-in", items = [], notes = "" } = req.body || {};
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "No items" });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const hydrated = [];
    for (const it of items) {
      if (!it.productId || !it.quantity || !it.sellingPrice) {
        throw new Error("Invalid item payload");
      }
      const p = await Product.findById(it.productId).session(session);
      if (!p) throw new Error(`Product not found: ${it.productId}`);
      if (p.quantity < it.quantity)
        throw new Error(`Not enough stock for ${p.name}`);

      const sellingPrice = Number(it.sellingPrice);
      const quantity = Number(it.quantity);
      hydrated.push({
        productId: p._id,
        name: p.name,
        quantity,
        sellingPrice,
        total: quantity * sellingPrice,
      });

      // Deduct stock atomically
      const upd = await Product.updateOne(
        { _id: p._id, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { session }
      );
      if (upd.matchedCount === 0)
        throw new Error(`Concurrent stock change for ${p.name}`);
    }

    const totalAmount = hydrated.reduce((s, i) => s + i.total, 0);

    const bill = await Bill.create(
      [{ customerName, items: hydrated, totalAmount, notes }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    res.json({ ok: true, bill: bill[0] });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    next(e);
  }
};

// DELETE /api/bills/:id
exports.remove = async (req, res, next) => {
  try {
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};