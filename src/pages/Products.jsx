import React, { useEffect, useState, useMemo } from "react";
import { getCachedList } from "../services/offline";
import { api } from "../services/api.js";
import {
  getSettingsSync,
  subscribeSettings,
  formatCurrency,
  formatDate,
} from "../services/settings";
import ProductForm from "../components/ProductForm.jsx";
import ProductTable from "../components/ProductTable.jsx";
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  Package,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [settings, setSettings] = useState(getSettingsSync());

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState("table"); // table or grid

  async function load(q = "") {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listProducts(q);
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      setError("Failed to load products. Please try again.");
      console.error("Load products error:", error);
    } finally {
      setLoading(false);
    }
  }

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    // Instant hydrate from cache
    getCachedList("products").then((cached) => {
      if (Array.isArray(cached) && cached.length) {
        setProducts(cached);
        setLoading(false);
      }
    }).finally(() => {
      load();
    });
    // Subscribe to settings changes
    const unsubscribe = subscribeSettings((newSettings) => {
      setSettings(newSettings);
    });
    return () => unsubscribe();
  }, []);

  // Clear success/error messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  async function onCreate(p) {
    try {
      await api.createProduct(p);
      setSuccess("Product created successfully!");
      setShowForm(false);
      await load(query);
    } catch (error) {
      setError("Failed to create product. Please try again.");
      console.error("Create product error:", error);
    }
  }

  async function onUpdate(p) {
    try {
      await api.updateProduct(editing._id, p);
      setSuccess("Product updated successfully!");
      setEditing(null);
      setShowForm(false);
      await load(query);
    } catch (error) {
      setError("Failed to update product. Please try again.");
      console.error("Update product error:", error);
    }
  }

  async function onDelete(id) {
    const confirmMessage = settings.requirePasswordForDelete
      ? "This action requires confirmation. Are you sure you want to delete this product?"
      : "Are you sure you want to delete this product?";

    if (!confirm(confirmMessage)) return;

    try {
      await api.deleteProduct(id);
      setSuccess("Product deleted successfully!");
      await load(query);
    } catch (error) {
      setError("Failed to delete product. Please try again.");
      console.error("Delete product error:", error);
    }
  }

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = [
      ...new Set(products.map((p) => p.category || "Uncategorized")),
    ];
    return cats.sort();
  }, [products]);

  // Apply filters and sorting
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (p) => (p.category || "Uncategorized") === categoryFilter
      );
    }

    // Stock filter - use settings threshold
    const threshold = Number(settings.lowStockThreshold) || 5;
    if (stockFilter === "low") {
      filtered = filtered.filter(
        (p) => (Number(p.quantity) || 0) <= (Number(p.minStock) || threshold)
      );
    } else if (stockFilter === "out") {
      filtered = filtered.filter((p) => (Number(p.quantity) || 0) === 0);
    } else if (stockFilter === "in") {
      filtered = filtered.filter((p) => (Number(p.quantity) || 0) > 0);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "category":
          return (a.category || "").localeCompare(b.category || "");
        case "quantity":
          return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
        case "price":
          return (
            (Number(b.defaultSellPrice) || 0) -
            (Number(a.defaultSellPrice) || 0)
          );
        case "updated":
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    products,
    categoryFilter,
    stockFilter,
    sortBy,
    settings.lowStockThreshold,
  ]);

  const stats = useMemo(() => {
    const threshold = Number(settings.lowStockThreshold) || 5;
    return {
      total: products.length,
      lowStock: products.filter(
        (p) => (Number(p.quantity) || 0) <= (Number(p.minStock) || threshold)
      ).length,
      outOfStock: products.filter((p) => (Number(p.quantity) || 0) === 0)
        .length,
      totalValue: products.reduce(
        (sum, p) =>
          sum + (Number(p.quantity) || 0) * (Number(p.costPrice) || 0),
        0
      ),
    };
  }, [products, settings.lowStockThreshold]);

  const title = useMemo(
    () => (editing ? "Edit Product" : "Add New Product"),
    [editing]
  );

  function handleExport() {
    const csv = [
      [
        "Name",
        "SKU",
        "Category",
        "Quantity",
        "Cost Price",
        "Sell Price",
        "Last Updated",
      ].join(","),
      ...filteredProducts.map((p) =>
        [
          `"${(p.name || "").replace(/"/g, '""')}"`,
          `"${(p.sku || "").replace(/"/g, '""')}"`,
          `"${(p.category || "").replace(/"/g, '""')}"`,
          p.quantity || 0,
          p.costPrice || 0,
          p.defaultSellPrice || 0,
          formatDate(p.updatedAt || new Date()),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold page-heading">
            Product Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your inventory and track stock levels for{" "}
            {settings.storeName}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center">
          <div className="h-5 w-5 text-green-600 mr-3">✓</div>
          <span className="text-green-800 dark:text-green-200">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
          <span className="text-red-800 dark:text-red-200">{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Products"
          value={stats.total}
          icon={Package}
          color="bg-blue-500"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStock}
          icon={AlertTriangle}
          color={stats.lowStock > 0 ? "bg-orange-500" : "bg-gray-500"}
        />
        <StatCard
          title="Out of Stock"
          value={stats.outOfStock}
          icon={AlertTriangle}
          color={stats.outOfStock > 0 ? "bg-red-500" : "bg-gray-500"}
        />
        <StatCard
          title="Inventory Value"
          value={formatCurrency(stats.totalValue)}
          icon={Package}
          color="bg-green-500"
        />
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Search products by name, SKU, or category..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Stock</option>
              <option value="in">In Stock</option>
              <option value="low">
                Low Stock (≤{settings.lowStockThreshold})
              </option>
              <option value="out">Out of Stock</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Sort: Name</option>
              <option value="category">Sort: Category</option>
              <option value="quantity">Sort: Stock</option>
              <option value="price">Sort: Price</option>
              <option value="updated">Sort: Updated</option>
            </select>

            <button
              onClick={() => load(query)}
              disabled={loading}
              className="flex items-center px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-2 text-sm ${
                  viewMode === "table"
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 text-sm ${
                  viewMode === "grid"
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
              >
                <EyeOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Results Info */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {filteredProducts.length} of {products.length} products
            {categoryFilter !== "all" && ` in ${categoryFilter}`}
            {stockFilter !== "all" &&
              ` • ${
                stockFilter === "low"
                  ? `Low stock (≤${settings.lowStockThreshold})`
                  : stockFilter === "out"
                  ? "Out of stock"
                  : "In stock"
              }`}
          </span>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-blue-600 hover:text-blue-700"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <ProductForm
              initial={editing}
              onSubmit={editing ? onUpdate : onCreate}
            />
          </div>
        </div>
      )}

      {/* Products Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">
              Loading products...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {query || categoryFilter !== "all" || stockFilter !== "all"
                ? "No products found"
                : "No products yet"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {query || categoryFilter !== "all" || stockFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Get started by adding your first product"}
            </p>
            {!query && categoryFilter === "all" && stockFilter === "all" && (
              <button
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="flex items-center mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Product
              </button>
            )}
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-hidden">
            <ProductTable
              products={filteredProducts}
              onEdit={(p) => {
                setEditing(p);
                setShowForm(true);
              }}
              onDelete={onDelete}
            />
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  settings={settings}
                  onEdit={() => {
                    setEditing(product);
                    setShowForm(true);
                  }}
                  onDelete={() => onDelete(product._id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {value}
          </p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, settings, onEdit, onDelete }) {
  const threshold = Number(settings.lowStockThreshold) || 5;
  const isLowStock =
    (Number(product.quantity) || 0) <= (Number(product.minStock) || threshold);
  const isOutOfStock = (Number(product.quantity) || 0) === 0;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {product.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {product.category || "Uncategorized"}
          </p>
          {product.sku && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              SKU: {product.sku}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onEdit}
            className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Stock:
          </span>
          <span
            className={`text-sm font-medium ${
              isOutOfStock
                ? "text-red-600"
                : isLowStock
                ? "text-orange-600"
                : "text-green-600"
            }`}
          >
            {product.quantity || 0}
            {isOutOfStock && " (Out)"}
            {isLowStock && !isOutOfStock && " (Low)"}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Cost:
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(Number(product.costPrice) || 0)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Sell:
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(Number(product.defaultSellPrice) || 0)}
          </span>
        </div>
      </div>

      {(isLowStock || isOutOfStock) && (
        <div
          className={`flex items-center text-xs px-2 py-1 rounded-full ${
            isOutOfStock
              ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
              : "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
          }`}
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          {isOutOfStock ? "Out of Stock" : "Low Stock"}
        </div>
      )}
    </div>
  );
}
