// models/Product.js
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    sku: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "General", index: true },
    quantity: { type: Number, default: 0, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    defaultSellPrice: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);
