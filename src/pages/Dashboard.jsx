import React, { useState, useEffect, useMemo } from "react";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Package from "lucide-react/dist/esm/icons/package";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Eye from "lucide-react/dist/esm/icons/eye";
import { api } from "../services/api.js";
import {
  getSettingsSync,
  loadSettings,
  subscribeSettings,
  formatCurrency,
} from "../services/settings";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStockItems: 0,
    todaySales: 0,
    monthSales: 0,
    totalCustomers: 0,
    recentBills: [],
    topProducts: [],
    monthlySalesData: [],
    weeklyGrowth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);
  const [error, setError] = useState(null);
  const [timeFilter, setTimeFilter] = useState("today");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    Number(getSettingsSync().lowStockThreshold) || 5
  );

  useEffect(() => {
    loadDashboardData();
  }, [timeFilter]);

  // Instant hydration from cached snapshot to reduce cold-start latency
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dashboard-snapshot-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.stats) {
          setStats(parsed.stats);
          setHydratedFromCache(true);
          setLoading(false);
        }
      }
    } catch {}
    // Regardless, ensure we refresh in background
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSettings().then((s) =>
      setLowStockThreshold(Number(s.lowStockThreshold) || 5)
    );
    const unsub = subscribeSettings((s) =>
      setLowStockThreshold(Number(s.lowStockThreshold) || 5)
    );
    return () => unsub();
  }, []);

  async function loadDashboardData() {
    try {
      if (!hydratedFromCache) setLoading(true);
      setError(null);

      const [products, bills] = await Promise.all([
        api.listProducts().catch(() => []),
        api.listBills().catch(() => []),
      ]);

      // Try to get customers, but don't fail if endpoint doesn't exist
      let customers = [];
      try {
        customers = await api.listCustomers();
      } catch (e) {
        console.warn("Customer API not available:", e.message);
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const totalProducts = products.length;
      const totalValue = products.reduce(
        (sum, p) =>
          sum + (Number(p.quantity) || 0) * (Number(p.costPrice) || 0),
        0
      );
      const lowStockItems = products.filter(
        (p) =>
          (Number(p.quantity) || 0) <=
          (Number(p.minStock) || Number(lowStockThreshold) || 5)
      ).length;

      const todayBills = bills.filter((b) => new Date(b.date) >= today);
      const monthBills = bills.filter((b) => new Date(b.date) >= thisMonth);
      const lastWeekBills = bills.filter((b) => new Date(b.date) >= lastWeek);

      const todaySales = todayBills.reduce(
        (sum, b) => sum + (b.totalAmount || 0),
        0
      );
      const monthSales = monthBills.reduce(
        (sum, b) => sum + (b.totalAmount || 0),
        0
      );
      const lastWeekSales = lastWeekBills.reduce(
        (sum, b) => sum + (b.totalAmount || 0),
        0
      );

      // Calculate weekly growth
      const previousWeekBills = bills.filter((b) => {
        const date = new Date(b.date);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        return date >= twoWeeksAgo && date < lastWeek;
      });
      const previousWeekSales = previousWeekBills.reduce(
        (sum, b) => sum + (b.totalAmount || 0),
        0
      );
      const weeklyGrowth =
        previousWeekSales > 0
          ? ((lastWeekSales - previousWeekSales) / previousWeekSales) * 100
          : 0;

      const recentBills = [...bills]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      const productSales = {};
      for (const bill of bills) {
        for (const item of bill.items || []) {
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              name: item.name,
              quantity: 0,
              revenue: 0,
            };
          }
          productSales[item.productId].quantity += Number(item.quantity) || 0;
          productSales[item.productId].revenue += Number(item.total) || 0;
        }
      }
      const topProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const monthlySalesData = [];
      for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(
          now.getFullYear(),
          now.getMonth() - i + 1,
          1
        );
        const mBills = bills.filter((b) => {
          const d = new Date(b.date);
          return d >= month && d < nextMonth;
        });
        const total = mBills.reduce((s, b) => s + (b.totalAmount || 0), 0);
        monthlySalesData.push({
          month: month.toLocaleDateString("en-US", { month: "short" }),
          sales: total,
          count: mBills.length,
        });
      }

      setStats({
        totalProducts,
        totalValue,
        lowStockItems,
        todaySales,
        monthSales,
        totalCustomers: customers.length || 0,
        recentBills,
        topProducts,
        monthlySalesData,
        weeklyGrowth,
      });
      // Save snapshot for next cold start
      try {
        localStorage.setItem(
          "dashboard-snapshot-v1",
          JSON.stringify({
            stats: {
              totalProducts,
              totalValue,
              lowStockItems,
              todaySales,
              monthSales,
              totalCustomers: customers.length || 0,
              recentBills,
              topProducts,
              monthlySalesData,
              weeklyGrowth,
            },
            ts: Date.now(),
            version: 1,
          })
        );
      } catch {}
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const StatCard = React.memo(({
    title,
    value,
    icon: Icon,
    color,
    change,
    changeType = "up",
    subtitle,
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
          {change !== undefined && (
            <div
              className={`flex items-center mt-2 text-sm ${
                changeType === "up" ? "text-green-600" : "text-red-600"
              }`}
            >
              {changeType === "up" ? (
                <ArrowUp className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDown className="h-4 w-4 mr-1" />
              )}
              {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color} shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  ));

  const maxSales = useMemo(
    () => Math.max(1, ...stats.monthlySalesData.map((d) => d.sales)),
    [stats.monthlySalesData]
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 h-80"></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 h-80"></div>
        </div>
      </div>
    );
  }

 

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold page-heading">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Welcome back! Here's what's happening in your store.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <button
            onClick={loadDashboardData}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Products"
          value={stats.totalProducts.toLocaleString()}
          icon={Package}
          color="bg-gradient-to-r from-blue-500 to-blue-600"
          subtitle={`${stats.lowStockItems} low stock items`}
        />
        <StatCard
          title="Inventory Value"
          value={formatCurrency(stats.totalValue)}
          icon={DollarSign}
          color="bg-gradient-to-r from-green-500 to-green-600"
        />
        <StatCard
          title="Today's Sales"
          value={formatCurrency(stats.todaySales)}
          icon={TrendingUp}
          color="bg-gradient-to-r from-purple-500 to-purple-600"
          change={stats.weeklyGrowth}
          changeType={stats.weeklyGrowth >= 0 ? "up" : "down"}
        />
        <StatCard
          title="Low Stock Alert"
          value={stats.lowStockItems}
          icon={AlertTriangle}
          color={
            stats.lowStockItems > 0
              ? "bg-gradient-to-r from-red-500 to-red-600"
              : "bg-gradient-to-r from-gray-500 to-gray-600"
          }
          subtitle={stats.lowStockItems > 0 ? "Needs attention" : "All good"}
        />
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 content-vis-auto">
        {/* Sales Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Monthly Sales Trend
            </h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-64 flex items-end justify-between space-x-2">
            {stats.monthlySalesData.slice(-6).map((data, i) => {
              const height = maxSales > 0 ? (data.sales / maxSales) * 200 : 0;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center flex-1 group"
                >
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatCurrency(data.sales)}
                  </div>
                  <div
                    className="bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg w-full min-h-[4px] transition-all duration-300 hover:from-blue-600 hover:to-blue-500 cursor-pointer"
                    style={{ height: `${Math.max(height, 4)}px` }}
                    title={`${data.month}: ${formatCurrency(data.sales)} (${
                      data.count
                    } orders)`}
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
                    {data.month}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Selling Products
            </h3>
            <Package className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {stats.topProducts.length ? (
              stats.topProducts.map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {product.quantity} units sold
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No sales data available
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 content-vis-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Sales
          </h3>
          <ShoppingCart className="h-5 w-5 text-gray-400" />
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white dark:bg-gray-800">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                  Customer
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                  Date
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">
                  Items
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-white">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recentBills.length ? (
                stats.recentBills.map((bill) => (
                  <tr
                    key={bill._id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="py-3 px-4 text-gray-900 dark:text-white">
                      {bill.customerName || "Walk-in"}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {new Date(bill.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {(bill.items || []).length} items
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(bill.totalAmount || 0)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No recent sales
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
