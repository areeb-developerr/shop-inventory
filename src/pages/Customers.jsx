import React, { useState, useEffect, useMemo } from "react";
import { getCachedList } from "../services/offline";
import { Users, UserPlus, Search, Eye, Edit } from "lucide-react";
import { api } from "../services/api.js";
import { formatCurrency } from "../services/settings.js";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  useEffect(() => {
    Promise.all([getCachedList("customers"), getCachedList("bills")])
      .then(([cCached, bCached]) => {
        let hydrated = false;
        if (Array.isArray(cCached) && cCached.length) {
          setCustomers(cCached);
          hydrated = true;
        }
        if (Array.isArray(bCached) && bCached.length) {
          setBills(bCached);
          hydrated = true;
        }
        if (hydrated) setLoading(false);
      })
      .finally(() => {
        loadData();
      });
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [customersData, billsData] = await Promise.all([
        api.listCustomers?.() || [],
        api.listBills(),
      ]);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setBills(Array.isArray(billsData) ? billsData : []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Pre-index bills by customer name (case-insensitive) for O(1) lookups
  const billsByCustomer = useMemo(() => {
    const map = new Map();
    for (const b of bills) {
      const key = (b.customerName || "").trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    return map;
  }, [bills]);

  const getCustomerStats = (customer) => {
    const list = billsByCustomer.get((customer.name || "").toLowerCase()) || [];
    const totalSpent = list.reduce(
      (sum, bill) => sum + (bill.totalAmount || 0),
      0
    );
    const totalOrders = list.length;
    const averageOrderValue = totalOrders ? totalSpent / totalOrders : 0;
    const lastPurchase = list.length
      ? new Date(
          Math.max(...list.map((bill) => new Date(bill.date).getTime() || 0))
        )
      : null;
    return { totalSpent, totalOrders, averageOrderValue, lastPurchase };
  };

  const getCustomerTier = (totalSpent) => {
    if (totalSpent >= 5000)
      return {
        tier: "Platinum",
        color: "bg-purple-100 text-purple-800",
        icon: "⭐",
      };
    if (totalSpent >= 2000)
      return {
        tier: "Gold",
        color: "bg-yellow-100 text-yellow-800",
        icon: "🥇",
      };
    if (totalSpent >= 500)
      return { tier: "Silver", color: "bg-gray-100 text-gray-800", icon: "🥈" };
    return {
      tier: "Bronze",
      color: "bg-orange-100 text-orange-800",
      icon: "🥉",
    };
  };

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = customers.filter((c) => {
      const matches =
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        (c.phone || "").includes(searchQuery);
      if (filterType === "all") return matches;
      const stats = getCustomerStats(c);
      const tier = getCustomerTier(stats.totalSpent);
      return matches && tier.tier.toLowerCase() === filterType;
    });

    return base.sort((a, b) => {
      const A = getCustomerStats(a);
      const B = getCustomerStats(b);
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "totalSpent":
          return B.totalSpent - A.totalSpent;
        case "totalOrders":
          return B.totalOrders - A.totalOrders;
        case "lastPurchase":
          if (!A.lastPurchase && !B.lastPurchase) return 0;
          if (!A.lastPurchase) return 1;
          if (!B.lastPurchase) return -1;
          return B.lastPurchase - A.lastPurchase;
        default:
          return 0;
      }
    });
  }, [customers, searchQuery, filterType, sortBy, billsByCustomer]);

  const CustomerForm = ({ customer, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
      name: customer?.name || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      address: customer?.address || "",
      notes: customer?.notes || "",
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);
      await onSubmit(formData);
      setSaving(false);
    };

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {customer ? "Edit Customer" : "Add New Customer"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {["name", "email", "phone"].map((k) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">
                  {k}
                  {k === "name" ? " *" : ""}
                </label>
                <input
                  type={
                    k === "email" ? "email" : k === "phone" ? "tel" : "text"
                  }
                  required={k === "name"}
                  value={formData[k]}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, [k]: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            ))}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : customer ? "Update" : "Add"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold page-heading">Customer Management</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4 mr-2" /> Add Customer
        </button>
      </div>

      {/* Search / Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Tiers</option>
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="bronze">Bronze</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="name">Sort: Name</option>
          <option value="totalSpent">Sort: Total Spent</option>
          <option value="totalOrders">Sort: Orders</option>
          <option value="lastPurchase">Sort: Last Purchase</option>
        </select>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer) => {
          const stats = getCustomerStats(customer);
          const tier = getCustomerTier(stats.totalSpent);
          return (
            <div
              key={customer._id || customer.name}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">
                      {(customer.name || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {customer.name}
                    </h3>
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${tier.color}`}
                    >
                      {tier.icon} {tier.tier}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Row
                  label="Total Spent"
                  value={
                    <span className="font-semibold text-green-600">
                      {formatCurrency(stats.totalSpent)}
                    </span>
                  }
                />
                <Row
                  label="Orders"
                  value={
                    <span className="font-semibold">{stats.totalOrders}</span>
                  }
                />
                <Row
                  label="Avg Order"
                  value={
                    <span className="font-semibold">
                      {formatCurrency(stats.averageOrderValue)}
                    </span>
                  }
                />
                {stats.lastPurchase && (
                  <Row
                    label="Last Purchase"
                    value={
                      <span className="text-sm">
                        {stats.lastPurchase.toLocaleDateString()}
                      </span>
                    }
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => alert(JSON.stringify(customer, null, 2))}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                  title="View"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setEditingCustomer(customer)}
                  className="p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCustomers.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No customers found</p>
        </div>
      )}

      {/* Modals */}
      {showAddForm && (
        <CustomerForm
          onSubmit={async (data) => {
            try {
              await api.createCustomer?.(data);
              setShowAddForm(false);
              loadData();
            } catch (error) {
              alert("Error adding customer");
            }
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {editingCustomer && (
        <CustomerForm
          customer={editingCustomer}
          onSubmit={async (data) => {
            try {
              await api.updateCustomer?.(editingCustomer._id, data);
              setEditingCustomer(null);
              loadData();
            } catch (error) {
              alert("Error updating customer");
            }
          }}
          onCancel={() => setEditingCustomer(null)}
        />
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      {value}
    </div>
  );
}
