import React, { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { isAuthenticated, logout, loginLocal } from "./services/auth";
import { api } from "./services/api.js";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Package from "lucide-react/dist/esm/icons/package";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import PlusCircle from "lucide-react/dist/esm/icons/plus-circle";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Users from "lucide-react/dist/esm/icons/users";
import SettingsIcon from "lucide-react/dist/esm/icons/settings";
import Bell from "lucide-react/dist/esm/icons/bell";
import Search from "lucide-react/dist/esm/icons/search";
import Moon from "lucide-react/dist/esm/icons/moon";
import Sun from "lucide-react/dist/esm/icons/sun";
import Info from "lucide-react/dist/esm/icons/info"; // Add this import
const About = lazy(() => import("./pages/About.jsx")); // Add this line
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Products = lazy(() => import("./pages/Products.jsx"));
const CreateBill = lazy(() => import("./pages/CreateBill.jsx"));
const Bills = lazy(() => import("./pages/Bills.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const Customers = lazy(() => import("./pages/Customers.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));
import {
  getSettingsSync,
  loadSettings,
  subscribeSettings,
  formatDate,
} from "./services/settings";
import { isOnline } from "./services/offline.js";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [auth, setAuth] = useState({ loggedIn: isAuthenticated() });
  const [settings, setSettings] = useState(getSettingsSync());
  const [darkMode, setDarkMode] = useState(() => {
    try {
      // First check if theme is set in settings
      const initialSettings = getSettingsSync();
      if (initialSettings.theme) {
        return initialSettings.theme === "dark";
      }
      // Fall back to localStorage for backwards compatibility
      const saved = localStorage.getItem("shopflow-dark-mode");
      if (saved === null) return true; // default to dark
      return saved === "true";
    } catch {
      return true;
    }
  });
  const [notifications, setNotifications] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    let interval;
    const run = () => {
      checkLowStock();
      interval = setInterval(checkLowStock, 60000); // Check every minute
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 3000 });
      return () => {
        if (interval) clearInterval(interval);
        window.cancelIdleCallback?.(id);
      };
    } else {
      // Fallback: defer to next frame then run
      const raf = requestAnimationFrame(() => setTimeout(run, 0));
      return () => {
        if (interval) clearInterval(interval);
        cancelAnimationFrame(raf);
      };
    }
  }, [settings.lowStockThreshold]);

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = subscribeSettings((newSettings) => {
      setSettings(newSettings);
      // Update dark mode when theme changes in settings
      if (newSettings.theme) {
        setDarkMode(newSettings.theme === "dark");
      }
    });
    return unsubscribe;
  }, []);

  // Persist theme choice and update settings
  useEffect(() => {
    try {
      localStorage.setItem("shopflow-dark-mode", darkMode ? "true" : "false");
      // Update theme in settings if different
      if (settings.theme !== (darkMode ? "dark" : "light")) {
        // Don't await to avoid blocking UI
        import("./services/settings").then(({ saveSettings }) => {
          saveSettings({ ...settings, theme: darkMode ? "dark" : "light" });
        });
      }
    } catch {}
  }, [darkMode, settings]);

  useEffect(() => {
    loadSettings();

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onFlushed = (e) => {
      const num = e?.detail?.flushed || 0;
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: "sync",
          message: `Synced ${num} offline ${num === 1 ? "action" : "actions"}`,
          time: formatDate(new Date(), true),
        },
      ]);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("queue-flushed", onFlushed);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("queue-flushed", onFlushed);
    };
  }, []);

  const checkLowStock = async () => {
    try {
      if (!settings.lowStockAlerts) return; // Don't check if alerts are disabled

      const products = await api.listProducts();
      const threshold = Number(settings.lowStockThreshold) || 5;
      const lowStock = products.filter(
        (p) => (Number(p.quantity) || 0) <= (Number(p.minStock) || threshold)
      );
      setLowStockCount(lowStock.length);

      if (lowStock.length > 0) {
        setNotifications((prev) => {
          const existing = prev.find((n) => n.type === "low-stock");
          if (!existing) {
            return [
              ...prev,
              {
                id: Date.now(),
                type: "low-stock",
                message: `${lowStock.length} products are running low on stock`,
                time: formatDate(new Date(), true),
              },
            ];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("Error checking stock:", error);
    }
  };

  const navigation = useMemo(
    () => [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: BarChart3,
        color: "bg-blue-500",
      },
      {
        id: "products",
        label: "Products",
        icon: Package,
        color: "bg-green-500",
      },
      {
        id: "create-bill",
        label: "New Sale",
        icon: PlusCircle,
        color: "bg-purple-500",
      },
      {
        id: "bills",
        label: "Sales History",
        icon: Receipt,
        color: "bg-orange-500",
      },
      {
        id: "analytics",
        label: "Analytics",
        icon: TrendingUp,
        color: "bg-pink-500",
      },
      {
        id: "customers",
        label: "Customers",
        icon: Users,
        color: "bg-indigo-500",
      },
      {
        id: "settings",
        label: "Settings",
        icon: SettingsIcon,
        color: "bg-gray-500",
      },
      {
        id: "about",
        label: "About",
        icon: Info,
        color: "bg-yellow-500",
      },
    ],
    []
  );

  const renderContent = () => {
    switch (tab) {
      case "dashboard":
        return <Dashboard setTab={setTab} />;
      case "products":
        return <Products />;
      case "create-bill":
        return <CreateBill />;
      case "bills":
        return <Bills />;
      case "analytics":
        return <Analytics />;
      case "customers":
        return <Customers />;
      case "settings":
        return <SettingsPage />;
      case "about":
        return <About />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div
      className={`min-h-screen ${
        darkMode ? "dark bg-gray-900" : "bg-gray-50"
      } transition-colors duration-300`}
    >
      {!auth.loggedIn ? (
        <LoginScreen onSuccess={() => setAuth({ loggedIn: true })} />
      ) : (
        <>
          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-xl border-r border-gray-200 dark:border-gray-700">
            {/* Logo */}
            <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {settings.storeName}
                </h1>
              </div>
            </div>

            {/* Navigation */}
            <nav className="mt-8 px-4 space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = tab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                      isActive
                        ? `${item.color} text-white shadow-lg transform scale-105`
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105"
                    }`}
                  >
                    <Icon
                      className={`mr-3 h-5 w-5 ${
                        isActive
                          ? "text-white"
                          : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200"
                      }`}
                    />
                    {item.label}
                    {item.id === "products" &&
                      lowStockCount > 0 &&
                      settings.lowStockAlerts && (
                        <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1">
                          {lowStockCount}
                        </span>
                      )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Stats */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 text-white">
                <div className="text-sm opacity-90">Quick Access</div>
                <div className="mt-2 space-y-1">
                  <button
                    onClick={() => setTab("create-bill")}
                    className="w-full text-left text-sm hover:underline"
                  >
                    💳 New Sale (Ctrl+N)
                  </button>
                  <button
                    onClick={() => setTab("products")}
                    className="w-full text-left text-sm hover:underline"
                  >
                    📦 Add Product (Ctrl+P)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="ml-64">
            {/* Top Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder={`Search products, customers, bills... (${settings.storeName})`}
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Online/Offline Indicator */}
                  <div className="flex items-center text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full ${
                        online
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                      title={
                        online ? "Online" : "Offline - actions will be queued"
                      }
                    >
                      <span
                        className={`w-2 h-2 rounded-full mr-2 ${
                          online ? "bg-green-600" : "bg-red-600"
                        }`}
                      ></span>
                      {online ? "Online" : "Offline"}
                    </span>
                  </div>

                  {/* Notifications */}
                  <div className="relative">
                    <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 relative">
                      <Bell className="h-5 w-5" />
                      {notifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {notifications.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Dark Mode Toggle */}
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {darkMode ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                  </button>

                  {/* User Menu */}
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {(settings.storeName || "Admin")
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {settings.storeName || "ShopFlow Store"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {settings.storeEmail || "admin@store.com"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setAuth({ loggedIn: false });
                    }}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Logout"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="p-6">
              <div className="max-w-7xl mx-auto">
                <Suspense
                  fallback={
                    <div className="p-6 text-gray-500 dark:text-gray-400">
                      Loading…
                    </div>
                  }
                >
                  {renderContent()}
                </Suspense>
              </div>
            </main>
          </div>

          {/* Offline Banner */}
          {!online && (
            <div className="fixed top-0 left-64 right-0 z-50">
              <div className="mx-6 mt-2 bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700 rounded-lg px-4 py-2 text-sm shadow">
                You are offline. Actions will be queued and synced automatically
                when back online.
              </div>
            </div>
          )}

          {/* Notifications Panel */}
          {notifications.length > 0 && (
            <div className="fixed top-20 right-6 z-50 w-80 space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="bg-white dark:bg-gray-800 border-l-4 border-yellow-500 p-4 shadow-lg rounded-lg animate-slide-in"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {notification.time}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setNotifications((prev) =>
                          prev.filter((n) => n.id !== notification.id)
                        )
                      }
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LoginScreen({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await loginLocal(username, password);
      if (!res?.token) throw new Error("Invalid login response");
      onSuccess();
      // Warm caches after login during idle time
      const warm = async () => {
        try {
          const { api } = await import("./services/api.js");
          await Promise.allSettled([
            api.listProducts().catch(() => {}),
            api.listBills().catch(() => {}),
            api.listCustomers?.().catch(() => {}),
          ]);
        } catch {}
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(warm, { timeout: 3000 });
      } else {
        setTimeout(warm, 0);
      }
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Sign in
        </h1>
        {error && (
          <div className="mb-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300 rounded p-2">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          <button
            disabled={loading}
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
