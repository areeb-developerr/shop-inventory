// models/Bill.js
const mongoose = require("mongoose");

const BillItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    sellingPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const BillSchema = new mongoose.Schema(
  {
    customerName: { type: String, default: "Walk-in", trim: true },
    date: { type: Date, default: Date.now },
    items: { type: [BillItemSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bill", BillSchema);
