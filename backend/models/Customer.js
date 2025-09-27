// models/Customer.js
const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// helpful indexes for search
CustomerSchema.index({ name: "text", email: "text", phone: "text" });

module.exports = mongoose.model("Customer", CustomerSchema);
