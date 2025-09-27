import { Cat } from "lucide-react";
import React, { useEffect, useState } from "react";
let Categories = [
  "Mobile Phones",
  "Charging Accessories",
  "USB & Cards",
  "Headphones & Speakers",
  "Smart Watches",
  "Others",
];

export default function ProductForm({ onSubmit, initial }) {
  const [form, setForm] = useState({
    sku: "",
    name: "",
    category: Categories[0] || "",
    quantity: null,
    costPrice: null,
    defaultSellPrice: null,
  });

  useEffect(() => {
    if (initial) setForm((prev) => ({ ...prev, ...initial }));
  }, [initial]);

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      quantity: Number(form.quantity) || 0,
      costPrice: Number(form.costPrice) || 0,
      defaultSellPrice: Number(form.defaultSellPrice) || 0,
    });
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col">
        <label className="font-semibold ml-1 mb-1">SKU (optional) :</label>
        <input
          className="border p-2 rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          placeholder=""
          value={form.sku}
          onChange={(e) => setField("sku", e.target.value)}
        />
      </div>
      <div className="flex flex-col">
        <label className="font-semibold ml-1 mb-1">Product Name :</label>
        <input
          className="border p-2 rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          placeholder=""
          required
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
        />
      </div>
      <div className="flex flex-col">
        <label className="font-semibold ml-1 mb-1">Category :</label>
        <select
          className="border p-2 rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          placeholder=""
          value={form.category}
          onChange={(e) => setField("category", e.target.value)}
        >
          {Categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="font-semibold ml-1 mb-1">Quantity :</label>
        <input
          className="border p-2 rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          type="number"
          min="0"
          step="1"
          placeholder=""
          required
          value={form.quantity}
          onChange={(e) => setField("quantity", e.target.value)}
        />
      </div>
      <div className="flex flex-col">
        <label className="font-semibold ml-1 mb-1">Cost Price :</label>
        <input
          className="border p-2 rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          type="number"
          min="0"
          step="0.01"
          placeholder=""
          value={form.costPrice}
          onChange={(e) => setField("costPrice", e.target.value)}
        />
      </div>
      <div className="flex flex-col">
        <label className="font-semibold ml-1 mb-1">Default Sell Price :</label>
        <input
          className="border p-2 rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          type="number"
          min="0"
          step="0.01"
          placeholder=""
          value={form.defaultSellPrice}
          onChange={(e) => setField("defaultSellPrice", e.target.value)}
        />
      </div>
      <button className="col-span-1 md:col-span-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
        Save
      </button>
    </form>
  );
}
