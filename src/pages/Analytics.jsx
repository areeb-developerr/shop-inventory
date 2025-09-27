import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  Calendar,
  Download,
  Filter,
  Eye,
  PieChart,
  LineChart,
  RefreshCw,
} from "lucide-react";
import { api } from "../services/api.js";
import {
  getSettingsSync,
  loadSettings,
  subscribeSettings,
} from "../services/settings";

export default function Analytics() {
  const [data, setData] = useState({
    salesAnalytics: {},
    productAnalytics: {},
    customerAnalytics: {},
    profitAnalytics: {},
    trends: {},
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30"); // days
  const [viewType, setViewType] = useState("overview");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    Number(getSettingsSync().lowStockThreshold) || 5
  );

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  useEffect(() => {
    loadSettings().then((s) =>
      setLowStockThreshold(Number(s.lowStockThreshold) || 5)
    );
    const unsub = subscribeSettings((s) =>
      setLowStockThreshold(Number(s.lowStockThreshold) || 5)
    );
    return () => unsub();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [products, bills, customers] = await Promise.all([
        api.listProducts(),
        api.listBills(),
        api.listCustomers?.() || Promise.resolve([]),
      ]);

      const daysAgo = parseInt(dateRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

      const recentBills = bills.filter(
        (bill) => new Date(bill.date) >= cutoffDate
      );

      // Sales Analytics
      const totalRevenue = recentBills.reduce(
        (sum, bill) => sum + bill.totalAmount,
        0
      );
      const totalTransactions = recentBills.length;
      const averageOrderValue =
        totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      // Daily sales breakdown
      const dailySales = {};
      recentBills.forEach((bill) => {
        const date = new Date(bill.date).toDateString();
        dailySales[date] = (dailySales[date] || 0) + bill.totalAmount;
      });

      const salesTrend = Object.entries(dailySales)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([date, amount]) => ({
          date: new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          amount: amount,
          fullDate: date,
        }));

      // Product Analytics
      const productSales = {};
      const productRevenue = {};
      const productProfit = {};

      recentBills.forEach((bill) => {
        bill.items.forEach((item) => {
          const productId = item.productId;
          productSales[productId] =
            (productSales[productId] || 0) + item.quantity;
          productRevenue[productId] =
            (productRevenue[productId] || 0) + item.total;

          // Calculate profit (selling price - cost price)
          const product = products.find((p) => p._id === productId);
          if (product) {
            const profit =
              (item.sellingPrice - product.costPrice) * item.quantity;
            productProfit[productId] = (productProfit[productId] || 0) + profit;
          }
        });
      });

      const topSellingProducts = products
        .map((product) => ({
          ...product,
          quantitySold: productSales[product._id] || 0,
          revenue: productRevenue[product._id] || 0,
          profit: productProfit[product._id] || 0,
        }))
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 10);

      const topRevenueProducts = products
        .map((product) => ({
          ...product,
          quantitySold: productSales[product._id] || 0,
          revenue: productRevenue[product._id] || 0,
          profit: productProfit[product._id] || 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Customer Analytics
      const customerPurchases = {};
      recentBills.forEach((bill) => {
        customerPurchases[bill.customerName] =
          (customerPurchases[bill.customerName] || 0) + bill.totalAmount;
      });

      const topCustomers = Object.entries(customerPurchases)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      // Category Analytics
      const categoryData = {};
      products.forEach((product) => {
        const category = product.category || "Uncategorized";
        if (!categoryData[category]) {
          categoryData[category] = {
            totalProducts: 0,
            totalValue: 0,
            totalSold: 0,
            revenue: 0,
          };
        }
        categoryData[category].totalProducts++;
        categoryData[category].totalValue +=
          product.quantity * product.costPrice;
        categoryData[category].totalSold += productSales[product._id] || 0;
        categoryData[category].revenue += productRevenue[product._id] || 0;
      });

      // Profit Analytics
      const totalProfit = Object.values(productProfit).reduce(
        (sum, profit) => sum + profit,
        0
      );
      const totalCost = recentBills.reduce((sum, bill) => {
        return (
          sum +
          bill.items.reduce((itemSum, item) => {
            const product = products.find((p) => p._id === item.productId);
            return itemSum + (product ? product.costPrice * item.quantity : 0);
          }, 0)
        );
      }, 0);

      const profitMargin =
        totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      // Low Stock Analysis
      const lowStockProducts = products.filter(
        (p) =>
          (Number(p.quantity) || 0) <=
          (Number(p.minStock) || Number(lowStockThreshold) || 5)
      );
      const outOfStockProducts = products.filter((p) => p.quantity === 0);

      // Growth calculations
      const previousPeriodBills = bills.filter((bill) => {
        const billDate = new Date(bill.date);
        const previousCutoff = new Date();
        previousCutoff.setDate(previousCutoff.getDate() - daysAgo * 2);
        return billDate >= previousCutoff && billDate < cutoffDate;
      });

      const previousRevenue = previousPeriodBills.reduce(
        (sum, bill) => sum + bill.totalAmount,
        0
      );
      const revenueGrowth =
        previousRevenue > 0
          ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
          : 0;

      setData({
        salesAnalytics: {
          totalRevenue,
          totalTransactions,
          averageOrderValue,
          salesTrend,
          revenueGrowth,
        },
        productAnalytics: {
          topSellingProducts,
          topRevenueProducts,
          categoryData,
          lowStockProducts,
          outOfStockProducts,
        },
        customerAnalytics: {
          topCustomers,
          totalCustomers: customers.length,
          averageCustomerValue:
            topCustomers.length > 0 ? totalRevenue / topCustomers.length : 0,
        },
        profitAnalytics: {
          totalProfit,
          totalCost,
          profitMargin,
          productProfit,
        },
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      dateRange: `${dateRange} days`,
      ...data,
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `analytics-report-${
      new Date().toISOString().split("T")[0]
    }.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const MetricCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
          {trend && (
            <div
              className={`flex items-center mt-2 text-sm ${
                trend > 0
                  ? "text-green-600"
                  : trend < 0
                  ? "text-red-600"
                  : "text-gray-500"
              }`}
            >
              {trend > 0 ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : trend < 0 ? (
                <TrendingDown className="h-4 w-4 mr-1" />
              ) : null}
              {trend !== 0 && `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%`}
            </div>
          )}
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
            Loading analytics...
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
          <h1 className="text-3xl font-bold page-heading">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Detailed insights and business intelligence for your store
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
            <option value="365">Last year</option>
          </select>
          <button
            onClick={exportReport}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors no-print"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={loadAnalytics}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors no-print"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* View Type Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "sales", label: "Sales", icon: TrendingUp },
            { id: "products", label: "Products", icon: Package },
            { id: "customers", label: "Customers", icon: Users },
            { id: "profit", label: "Profit", icon: DollarSign },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setViewType(tab.id)}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  viewType === tab.id
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview View */}
      {viewType === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Revenue"
              value={`${
                data.salesAnalytics.totalRevenue?.toLocaleString() || 0
              }`}
              icon={DollarSign}
              color="bg-green-500"
              trend={data.salesAnalytics.revenueGrowth}
            />
            <MetricCard
              title="Total Transactions"
              value={
                data.salesAnalytics.totalTransactions?.toLocaleString() || 0
              }
              icon={BarChart3}
              color="bg-blue-500"
            />
            <MetricCard
              title="Average Order Value"
              value={`${
                data.salesAnalytics.averageOrderValue?.toFixed(2) || 0
              }`}
              icon={TrendingUp}
              color="bg-purple-500"
            />
            <MetricCard
              title="Profit Margin"
              value={`${data.profitAnalytics.profitMargin?.toFixed(1) || 0}%`}
              icon={PieChart}
              color="bg-orange-500"
            />
          </div>

          {/* Sales Trend Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Sales Trend
            </h3>
            <div className="h-64 flex items-end justify-between space-x-2">
              {data.salesAnalytics.salesTrend?.map((point, index) => {
                const maxAmount = Math.max(
                  ...data.salesAnalytics.salesTrend.map((p) => p.amount)
                );
                const height =
                  maxAmount > 0 ? (point.amount / maxAmount) * 200 : 0;

                return (
                  <div
                    key={index}
                    className="flex flex-col items-center flex-1"
                  >
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      ${point.amount.toFixed(0)}
                    </div>
                    <div
                      className="bg-blue-500 rounded-t-lg w-full min-h-[4px] transition-all duration-300 hover:bg-blue-600"
                      style={{ height: `${height}px` }}
                      title={`${point.date}: ${point.amount.toLocaleString()}`}
                    ></div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45 origin-bottom-left">
                      {point.date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sales View */}
      {viewType === "sales" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Total Revenue"
              value={`${
                data.salesAnalytics.totalRevenue?.toLocaleString() || 0
              }`}
              icon={DollarSign}
              color="bg-green-500"
              subtitle={`${
                data.salesAnalytics.totalTransactions || 0
              } transactions`}
              trend={data.salesAnalytics.revenueGrowth}
            />
            <MetricCard
              title="Average Order Value"
              value={`${
                data.salesAnalytics.averageOrderValue?.toFixed(2) || 0
              }`}
              icon={BarChart3}
              color="bg-blue-500"
            />
            <MetricCard
              title="Daily Average"
              value={`${(
                (data.salesAnalytics.totalRevenue || 0) / parseInt(dateRange)
              ).toFixed(2)}`}
              icon={Calendar}
              color="bg-purple-500"
            />
          </div>

          {/* Top Customers */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Top Customers
            </h3>
            <div className="space-y-4">
              {data.customerAnalytics.topCustomers
                ?.slice(0, 5)
                .map((customer, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {index + 1}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {customer.name}
                      </span>
                    </div>
                    <span className="font-semibold text-green-600">
                      ${customer.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Products View */}
      {viewType === "products" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Selling Products */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Top Selling Products
              </h3>
              <div className="space-y-4">
                {data.productAnalytics.topSellingProducts
                  ?.slice(0, 5)
                  .map((product, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {product.quantitySold} units sold
                        </p>
                      </div>
                      <span className="font-semibold text-blue-600">
                        ${product.revenue.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Category Performance */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Category Performance
              </h3>
              <div className="space-y-4">
                {Object.entries(data.productAnalytics.categoryData || {}).map(
                  ([category, stats]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {category}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {stats.totalProducts} products
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          ${stats.revenue.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {stats.totalSold} sold
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Inventory Alerts */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Inventory Alerts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-red-600 mb-3">
                  Low Stock Items (
                  {data.productAnalytics.lowStockProducts?.length || 0})
                </h4>
                <div className="space-y-2">
                  {data.productAnalytics.lowStockProducts
                    ?.slice(0, 5)
                    .map((product, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded"
                      >
                        <span className="text-sm text-gray-900 dark:text-white">
                          {product.name}
                        </span>
                        <span className="text-sm font-medium text-red-600">
                          {product.quantity} left
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-red-600 mb-3">
                  Out of Stock (
                  {data.productAnalytics.outOfStockProducts?.length || 0})
                </h4>
                <div className="space-y-2">
                  {data.productAnalytics.outOfStockProducts
                    ?.slice(0, 5)
                    .map((product, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-red-100 dark:bg-red-900/30 rounded"
                      >
                        <span className="text-sm text-gray-900 dark:text-white">
                          {product.name}
                        </span>
                        <span className="text-sm font-medium text-red-700">
                          0 left
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profit View */}
      {viewType === "profit" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Total Profit"
              value={`${
                data.profitAnalytics.totalProfit?.toLocaleString() || 0
              }`}
              icon={DollarSign}
              color="bg-green-500"
            />
            <MetricCard
              title="Total Cost"
              value={`${data.profitAnalytics.totalCost?.toLocaleString() || 0}`}
              icon={TrendingDown}
              color="bg-red-500"
            />
            <MetricCard
              title="Profit Margin"
              value={`${data.profitAnalytics.profitMargin?.toFixed(1) || 0}%`}
              icon={PieChart}
              color="bg-blue-500"
            />
          </div>

          {/* Most Profitable Products */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Most Profitable Products
            </h3>
            <div className="space-y-4">
              {data.productAnalytics.topSellingProducts
                ?.sort((a, b) => b.profit - a.profit)
                .slice(0, 8)
                .map((product, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {product.quantitySold} units • $
                        {product.revenue.toLocaleString()} revenue
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        PKR {product.profit.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {product.revenue > 0
                          ? ((product.profit / product.revenue) * 100).toFixed(
                              1
                            )
                          : 0}
                        % margin
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
