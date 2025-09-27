import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";
import {
  Search,
  Plus,
  Minus,
  X,
  ShoppingCart,
  Package,
  User,
  AlertTriangle,
  Trash2,
  Calculator,
  Receipt,
} from "lucide-react";
import { formatCurrency } from "../services/settings.js";

const settings = JSON.parse(localStorage.getItem("shopflow-settings") || "{}");

export default function BillForm({ onSaved }) {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  async function load(query = "") {
    const data = await api.listProducts(query);
    setProducts(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  function addToCart(p) {
    const price = Number(p.defaultSellPrice || 0);
    const existing = cart.find((i) => i.productId === p._id);
    if (existing) {
      updateQty(p._id, existing.quantity + 1, p.quantity);
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: p._id,
          name: p.name,
          quantity: 1,
          sellingPrice: price,
          total: price,
          stock: Number(p.quantity) || 0,
        },
      ]);
    }
  }

  function updateQty(id, qty, stockHint) {
    setCart((prev) =>
      prev.map((i) =>
        i.productId === id
          ? {
              ...i,
              quantity: Math.max(1, Number(qty)),
              total: Math.max(1, Number(qty)) * Number(i.sellingPrice),
              stock: typeof stockHint === "number" ? stockHint : i.stock,
            }
          : i
      )
    );
  }

  function updatePrice(id, price) {
    setCart((prev) =>
      prev.map((i) => {
        // Allow empty string in state
        const isEmpty = price === "";
        const numericPrice = isEmpty ? "" : Math.max(0, Number(price));

        return i.productId === id
          ? {
              ...i,
              sellingPrice: numericPrice,
              total: (isEmpty ? 0 : numericPrice) * Number(i.quantity),
            }
          : i;
      })
    );
  }

  function removeItem(id) {
    setCart((prev) => prev.filter((i) => i.productId !== id));
  }

  function clearCart() {
    if (
      cart.length > 0 &&
      confirm("Are you sure you want to clear the cart?")
    ) {
      setCart([]);
    }
  }

  const grandTotal = useMemo(
    () => cart.reduce((s, i) => s + (i.total || 0), 0),
    [cart]
  );

  const totalItems = useMemo(
    () => cart.reduce((s, i) => s + (i.quantity || 0), 0),
    [cart]
  );

  async function saveBill() {
    if (!cart.length) return alert("Cart is empty");
    const overStock = cart.find(
      (i) => typeof i.stock === "number" && i.quantity > i.stock
    );
    if (overStock) {
      const proceed = confirm(
        `"${overStock.name}" quantity exceeds stock (${overStock.quantity} > ${overStock.stock}). Proceed anyway?`
      );
      if (!proceed) return;
    }

    try {
      setSaving(true);
      const payload = { customerName: customerName || "Walk-in", items: cart };
      const res = await api.createBill(payload);
      alert("Bill saved successfully!");

      const bill = res?.bill || payload;
      const html = renderInvoice(bill);

      if (window.electronAPI?.printHTML) {
        await window.electronAPI.printHTML(html);
      }

      setCart([]);
      setCustomerName("");
      onSaved?.();
      await load(q);
    } catch (e) {
      alert(e?.message || "Failed to save bill");
    } finally {
      setSaving(false);
    }
  }

  function renderInvoice(bill) {
    const settings = (() => {
      try {
        return JSON.parse(localStorage.getItem("shopflow-settings") || "{}");
      } catch (_) {
        return {};
      }
    })();

    const storeName = String(settings.storeName || "ShopFlow Store");
    const storeAddress = String(settings.storeAddress || "");
    const storePhone = String(settings.storePhone || "");

    const formatInt = (num) => Math.round(Number(num) || 0).toString();

    const items = (bill.items || []).map((i) => ({
      name: i.name,
      qty: Number(i.quantity) || 0,
      price: Number(i.sellingPrice) || 0,
      total:
        Number(i.total) ||
        (Number(i.quantity) || 0) * (Number(i.sellingPrice) || 0),
    }));

    const total =
      bill.totalAmount ?? items.reduce((s, i) => s + (i.total || 0), 0);

    const lines = items
      .map((i) => {
        const name = (i.name || "").toString();
        return `
    <div class="row">
      <div class="name">${name}</div>
      <div class="qty">${formatInt(i.qty)}</div>
      <div class="price">${formatInt(i.price)}</div>
      <div class="sum">${formatInt(i.total)}</div>
    </div>`;
      })
      .join("");

    const idLine = bill._id
      ? `<div class="muted">Order: ${bill._id}</div>`
      : "";

    return `
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      /* thermal roll: increased height */
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body { font-family: monospace, sans-serif; color: #111827; margin-top: 4px; }
      .receipt { width: 78mm; padding: 6px; }
      .center { text-align: left; }
      .header { margin-bottom: 8px; }
      .title { margin-bottom:4px; font-weight: 900; font-size: 22px; line-height: 1.3; align-items: center; text-align: center; }
      .muted { color: #6B7280; font-size: 14px; font-weight: 600; display:flex; flex-direction:column ;gap: 4px; line-height: 1.2; margin-bottom: 4px; }
      .divider { border-top: 1px dashed #9CA3AF; margin: 6px 0; }
      
      .row { 
        display: grid; 
        grid-template-columns: 1fr 9mm 13mm 15mm;
        font-size: 16px; 
        align-items: start; 
        gap: 7px;
        margin-bottom: 4px;
      }
      .row > div { padding: 1px 2px; }
      .head { font-weight: 800; color: #374151; border-bottom: 1px solid #999; padding-bottom: 2px; text-align: right; }
      .head .name { text-align: left; }

      .address, .phone { font-size: 16px;font-weight:600; line-height: 1.2; text-align: center; align-items: center; justify-content: center;  color: #6B7280; }
      
      .name { 
        text-align: left;
        word-wrap: break-word; 
        line-height: 1.1;
        font-size: 16px;
        overflow-wrap: break-word;
        hyphens: auto;
      }

      .qty{
        text-align: center; 
        font-size: 16px;
        padding-right: 1mm;
      }
      .price{
        padding-right: 1mm;}
      
      .sum{
        padding-left: 1mm;}

      .price, .sum { 
        text-align: right; 
        font-size: 16px;
      }
      .subtotal {
        display: flex; 
        justify-content: space-between; 
        font-weight: 800; 
        font-size: 16px; 
        margin-top: 2px;
        margin-bottom: 2px;
        align-items: center;
        padding: 2px 0;
      }

      .total { 
        display: flex; 
        justify-content: space-between; 
        font-weight: 800; 
        font-size: 16px; 
        margin-top: 12px;
        margin-bottom: 2px;
        border-top: 2px solid #9CA3AF; 
        padding: 10px 2px 4px 2px; 
        align-items: center;
      }
      .thanks { margin-top: 20px; font-size: 16px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header center">
        <div class="title">${storeName}</div>
        ${storeAddress ? `<div class="address">${storeAddress}</div>` : ""}
        ${storePhone ? `<div class="phone">${storePhone}</div>` : ""}
      </div>
      <div class="muted">
        <div>Date: ${new Date(bill.date || Date.now()).toLocaleString()}</div>
        <div>Customer: ${bill.customerName || "Walk-in"}</div>
        ${idLine}
      </div>
      <div class="divider"></div>
      <div class="row head">
        <div class="name">Item</div>
        <div>Qty</div>
        <div>Price</div>
        <div>Total</div>
      </div>
      <div class="divider"></div>
      ${lines}
      <div class="total">
        <div>Sub Total:</div>
        <div>${total}</div>
      </div>
      <div class="subtotal">
        <div>Tax:</div>
        <div> - </div>
      </div>
      <div class="subtotal">
        <div>Grand Total:</div>
        <div>${total}</div>
      </div>
      <div class="thanks">* Thank you for your purchase! *</div>
    </div>
  </body>
</html>
`;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Products Panel */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Products
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {products.length} items
            </span>
          </div>

          {/* Search */}
          <div
            className={`relative mb-4 transition-all ${
              searchFocused ? "transform scale-105" : ""
            }`}
          >
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search products..."
            />
          </div>

          {/* Product List */}
          <div className="max-h-96 overflow-auto space-y-2">
            {products.length ? (
              products.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {p.name}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mt-1">
                      <span
                        className={`${
                          Number(p.quantity) <= 5
                            ? "text-red-500"
                            : "text-green-600"
                        }`}
                      >
                        Stock: {p.quantity}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(Number(p.defaultSellPrice || 0))}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(p)}
                    disabled={Number(p.quantity) === 0}
                    className="ml-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-1 transition-colors disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No products found</p>
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="text-blue-600 hover:text-blue-700 text-sm mt-1"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Panel */}
      <div className="lg:col-span-2 space-y-4">
        {/* Customer Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-3">
            <User className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
            <label className="font-medium text-gray-900 dark:text-white">
              Customer Information
            </label>
          </div>
          <input
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter customer name (optional)"
          />
        </div>

        {/* Cart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Shopping Cart
                {cart.length > 0 && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                    {totalItems} items
                  </span>
                )}
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="flex items-center text-red-600 hover:text-red-700 text-sm"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear Cart
                </button>
              )}
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Your cart is empty
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Add products from the left panel to get started
              </p>
            </div>
          ) : (
            <div className="overflow-auto max-h-96">
              <table className="w-full table-fixed border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="w-1/4 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="w-1/5 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="w-1/5 px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="w-1/5 px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="w-12 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {cart.map((item) => (
                    <tr
                      key={item.productId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {/* Item Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {item.name}
                        </div>
                        {typeof item.stock === "number" &&
                          item.quantity > item.stock && (
                            <div className="flex items-center text-xs text-red-600 mt-1">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Exceeds stock ({item.stock})
                            </div>
                          )}
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                            onClick={() =>
                              updateQty(
                                item.productId,
                                Math.max(1, item.quantity - 1)
                              )
                            }
                            title="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <input
                            type="number"
                            min="1"
                            className="w-16 h-8 text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQty(item.productId, e.target.value)
                            }
                          />

                          <button
                            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                            onClick={() =>
                              updateQty(item.productId, item.quantity + 1)
                            }
                            title="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-24 h-8 px-2 text-right border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={item.sellingPrice ?? ""}
                          placeholder="0.00"
                          onChange={(e) => {
                            // Allow empty or decimal while typing
                            const val = e.target.value;
                            if (/^\d*\.?\d*$/.test(val) || val === "") {
                              updatePrice(item.productId, val);
                            }
                          }}
                          onBlur={(e) => {
                            // Normalize when user leaves input
                            const val = parseFloat(e.target.value);
                            updatePrice(
                              item.productId,
                              isNaN(val) ? 0 : val.toFixed(2)
                            );
                          }}
                        />
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(item.total || 0)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Remove item"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Calculator className="h-5 w-5 mr-2" />
                  <span>Total ({totalItems} items)</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(grandTotal)}
                </div>
              </div>

              <button
                onClick={saveBill}
                disabled={saving || cart.length === 0}
                className="w-full flex items-center justify-center px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing Sale...
                  </>
                ) : (
                  <>
                    <Receipt className="h-5 w-5 mr-2" />
                    Complete Sale & Print Receipt
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
