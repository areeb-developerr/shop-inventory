import React, { useEffect, useState, useMemo } from "react";
import { getCachedList } from "../services/offline";
import {
  Receipt,
  Search,
  Filter,
  Calendar,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  TrendingUp,
  DollarSign,
  FileText,
  ChevronLeft,
  ChevronRight,
  User,
  Package,
} from "lucide-react";
import { api } from "../services/api.js";
import { formatCurrency } from "../services/settings.js";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [selectedBill, setSelectedBill] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const itemsPerPage = 10;

  async function loadBills() {
    try {
      setLoading(true);
      const data = await api.listBills();
      setBills(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading bills:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getCachedList("bills").then((cached) => {
      if (Array.isArray(cached) && cached.length) {
        setBills(cached);
        setLoading(false);
      }
    }).finally(() => {
      loadBills();
    });
  }, []);

  // Filter and sort bills
  const filteredBills = useMemo(() => {
    let filtered = [...bills];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (bill) =>
          bill.customerName?.toLowerCase().includes(query) ||
          bill.items?.some((item) =>
            item.name?.toLowerCase().includes(query)
          ) ||
          bill._id?.toLowerCase().includes(query)
      );
    }

    // Date filter
    const now = new Date();
    if (dateFilter !== "all") {
      filtered = filtered.filter((bill) => {
        const billDate = new Date(bill.date);
        switch (dateFilter) {
          case "today":
            return billDate.toDateString() === now.toDateString();
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return billDate >= weekAgo;
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return billDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.date) - new Date(a.date);
        case "date-asc":
          return new Date(a.date) - new Date(b.date);
        case "amount-desc":
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        case "amount-asc":
          return (a.totalAmount || 0) - (b.totalAmount || 0);
        case "customer":
          return (a.customerName || "").localeCompare(b.customerName || "");
        default:
          return 0;
      }
    });

    return filtered;
  }, [bills, searchQuery, dateFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const paginatedBills = filteredBills.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Statistics
  const stats = useMemo(() => {
    const total = filteredBills.reduce(
      (sum, bill) => sum + (bill.totalAmount || 0),
      0
    );
    const count = filteredBills.length;
    const average = count > 0 ? total / count : 0;

    return {
      totalSales: total,
      totalTransactions: count,
      averageOrderValue: average,
    };
  }, [filteredBills]);

  const handleDeleteBill = async (billId) => {
    if (!confirm("Are you sure you want to delete this bill?")) return;

    try {
      await api.deleteBill(billId);
      await loadBills();
    } catch (error) {
      alert("Error deleting bill");
    }
  };

  const handleExport = () => {
    const csvData = [
      ["Date", "Customer", "Items", "Total Amount"],
      ...filteredBills.map((bill) => [
        new Date(bill.date).toLocaleDateString(),
        bill.customerName || "Walk-in",
        (bill.items || [])
          .map((item) => `${item.name} x${item.quantity}`)
          .join("; "),
        bill.totalAmount || 0,
      ]),
    ];

    const csvContent = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-lg text-gray-600 dark:text-gray-400">
            Loading sales history...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold page-heading">Sales History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage all your sales transactions
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
            onClick={loadBills}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Sales"
          value={formatCurrency(stats.totalSales)}
          icon={DollarSign}
          color="bg-green-500"
        />
        <StatCard
          title="Total Transactions"
          value={stats.totalTransactions.toLocaleString()}
          icon={Receipt}
          color="bg-blue-500"
        />
        <StatCard
          title="Average Order Value"
          value={formatCurrency(stats.averageOrderValue)}
          icon={TrendingUp}
          color="bg-purple-500"
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
              placeholder="Search by customer, product, or bill ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="date-desc">Latest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
              <option value="customer">Customer Name</option>
            </select>
          </div>
        </div>

        {/* Results Info */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {paginatedBills.length} of {filteredBills.length}{" "}
            transactions
            {dateFilter !== "all" &&
              ` • ${
                dateFilter === "today"
                  ? "Today"
                  : dateFilter === "week"
                  ? "Last 7 days"
                  : "Last 30 days"
              }`}
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-blue-600 hover:text-blue-700"
            >
              Clear search
            </button>
          )}
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {paginatedBills.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {filteredBills.length === 0
                ? "No transactions found"
                : "No results match your search"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {filteredBills.length === 0
                ? "Sales transactions will appear here once you start making sales"
                : "Try adjusting your search terms or filters"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedBills.map((bill) => (
                    <tr
                      key={bill._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(bill.date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(bill.date).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {bill.customerName || "Walk-in Customer"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {(bill.items || []).length} items
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                          {(bill.items || [])
                            .map((item) => `${item.name} x${item.quantity}`)
                            .join(", ")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(bill.totalAmount || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedBill(bill)}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBill(bill._id)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete Bill"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Page {currentPage} of {totalPages} • {filteredBills.length}{" "}
                    total transactions
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="flex items-center space-x-1">
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          const page = i + 1;
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 text-sm rounded ${
                                currentPage === page
                                  ? "bg-blue-500 text-white"
                                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        }
                      )}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Bill Details
              </h3>
              <button
                onClick={() => setSelectedBill(null)}
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

            <div className="space-y-6">
              {/* Bill Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Customer
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {selectedBill.customerName || "Walk-in Customer"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Date & Time
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedBill.date).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 block">
                  Items Purchased
                </label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Item
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Price
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(selectedBill.items || []).map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {item.name}
                          </td>
                          <td className="px-4 py-2 text-center text-gray-900 dark:text-white">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                            {formatCurrency(item.sellingPrice || 0)}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(item.total || 0)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <td
                          colSpan="3"
                          className="px-4 py-2 font-semibold text-gray-900 dark:text-white"
                        >
                          Grand Total
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-lg text-green-600">
                          {formatCurrency(selectedBill.totalAmount || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
