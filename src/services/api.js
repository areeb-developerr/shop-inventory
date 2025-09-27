const BASE = `http://localhost:${
  import.meta.env.VITE_BACKEND_PORT || 5000
}/api`;
import { getAuthToken } from "./auth";
import { enqueueRequest, isOnline, cacheList, getCachedList, flushQueue } from "./offline";

// Helper function for making requests with better error handling
async function req(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);

    // Handle non-200 responses
    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;

      try {
        const errorBody = await res.json();
        errorMessage = errorBody.error || errorBody.message || errorMessage;
      } catch {
        // If we can't parse the error response, use the status text
      }

      const error = new Error(errorMessage);
      error.status = res.status;
      error.statusText = res.statusText;
      throw error;
    }

    // Handle empty responses
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await res.json();
    } else {
      return res.text();
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("Request timeout - please check your connection");
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Network error - please check if the server is running");
    }

    console.error(`API Error [${path}]:`, error);
    throw error;
  }
}

// Helper function for handling query parameters
function buildQuery(params) {
  const filtered = Object.entries(params).filter(
    ([_, value]) => value !== null && value !== undefined && value !== ""
  );

  if (filtered.length === 0) return "";

  const query = new URLSearchParams(filtered).toString();
  return `?${query}`;
}

export const api = {
  // Auth
  login: async (email, password) => {
    const result = await req(`/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return result;
  },
  // Health check
  health: () => req("/health"),

  // Products
  listProducts: (q = "", filters = {}) => {
    const params = { q, ...filters };
    return req(`/products${buildQuery(params)}`)
      .then(async (data) => {
        await cacheList("products", Array.isArray(data) ? data : []);
        return data;
      })
      .catch(async (e) => {
        // Offline fallback
        const cached = await getCachedList("products");
        return cached;
      });
  },

  getProduct: (id) => {
    if (!id) throw new Error("Product ID is required");
    return req(`/products/${id}`);
  },

  createProduct: (data) => {
    if (!data || !data.name) {
      throw new Error("Product name is required");
    }
    if (!isOnline()) {
      return enqueueRequest({ type: "product:create", path: "/products", method: "POST", body: data });
    }
    return req(`/products`, { method: "POST", body: JSON.stringify(data) });
  },

  updateProduct: (id, data) => {
    if (!id) throw new Error("Product ID is required");
    if (!data) throw new Error("Product data is required");
    if (!isOnline()) {
      return enqueueRequest({ type: "product:update", path: `/products/${id}`, method: "PUT", body: data });
    }
    return req(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  deleteProduct: (id) => {
    if (!id) throw new Error("Product ID is required");
    if (!isOnline()) {
      return enqueueRequest({ type: "product:delete", path: `/products/${id}`, method: "DELETE" });
    }
    return req(`/products/${id}`, { method: "DELETE" });
  },

  // Get low stock products
  getLowStockProducts: (threshold = 5) =>
    req(`/products/low-stock${buildQuery({ threshold })}`),

  // Bills
  listBills: (filters = {}) => {
    return req(`/bills${buildQuery(filters)}`)
      .then(async (data) => {
        await cacheList("bills", Array.isArray(data) ? data : []);
        return data;
      })
      .catch(async () => getCachedList("bills"));
  },

  getBill: (id) => {
    if (!id) throw new Error("Bill ID is required");
    return req(`/bills/${id}`);
  },

  createBill: (data) => {
    if (
      !data ||
      !data.items ||
      !Array.isArray(data.items) ||
      data.items.length === 0
    ) {
      throw new Error("Bill must contain at least one item");
    }
    if (!isOnline()) {
      return enqueueRequest({ type: "bill:create", path: "/bills", method: "POST", body: data });
    }
    return req(`/bills`, { method: "POST", body: JSON.stringify(data) });
  },

  deleteBill: (id) => {
    if (!id) throw new Error("Bill ID is required");
    if (!isOnline()) {
      return enqueueRequest({ type: "bill:delete", path: `/bills/${id}`, method: "DELETE" });
    }
    return req(`/bills/${id}`, { method: "DELETE" });
  },

  // Customers (with fallback for when endpoints don't exist)
  listCustomers: (q = "") => {
    return req(`/customers${buildQuery({ q })}`)
      .then(async (data) => {
        await cacheList("customers", Array.isArray(data) ? data : []);
        return data;
      })
      .catch(async () => getCachedList("customers"));
  },

  getCustomer: (id) => {
    if (!id) throw new Error("Customer ID is required");
    return req(`/customers/${id}`);
  },

  createCustomer: (data) => {
    if (!data || !data.name) {
      throw new Error("Customer name is required");
    }
    if (!isOnline()) {
      return enqueueRequest({ type: "customer:create", path: "/customers", method: "POST", body: data });
    }
    return req(`/customers`, { method: "POST", body: JSON.stringify(data) });
  },

  updateCustomer: (id, data) => {
    if (!id) throw new Error("Customer ID is required");
    if (!data) throw new Error("Customer data is required");
    if (!isOnline()) {
      return enqueueRequest({ type: "customer:update", path: `/customers/${id}`, method: "PUT", body: data });
    }
    return req(`/customers/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  deleteCustomer: (id) => {
    if (!id) throw new Error("Customer ID is required");
    if (!isOnline()) {
      return enqueueRequest({ type: "customer:delete", path: `/customers/${id}`, method: "DELETE" });
    }
    return req(`/customers/${id}`, { method: "DELETE" });
  },

  // Analytics (with fallback)
  getAnalytics: (params = {}) => {
    const query = buildQuery(params);
    return req(`/analytics${query}`).catch((error) => {
      console.warn("Analytics endpoint not fully implemented");
      return { message: "Analytics data not available" };
    });
  },

  getDashboardStats: () => {
    return req(`/analytics/dashboard`).catch((error) => {
      console.warn("Dashboard analytics not available");
      return { message: "Dashboard stats not available" };
    });
  },

  // Inventory Management
  updateStock: (id, quantity, type = "set") => {
    if (!id) throw new Error("Product ID is required");
    if (quantity === undefined || quantity === null) {
      throw new Error("Quantity is required");
    }
    return req(`/products/${id}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: Number(quantity), type }),
    });
  },

  // Bulk operations
  bulkUpdateProducts: (updates) => {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error("Updates array is required");
    }
    return req(`/products/bulk`, {
      method: "PATCH",
      body: JSON.stringify({ updates }),
    });
  },

  bulkDeleteProducts: (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Product IDs array is required");
    }
    return req(`/products/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  },

  // Reports (with fallback)
  generateReport: (type, params = {}) => {
    const query = buildQuery({ type, ...params });
    return req(`/reports${query}`).catch((error) => {
      console.warn("Reports endpoint not implemented");
      return { message: "Reports not available" };
    });
  },

  // Settings
  getSettings: () => req(`/settings`),

  updateSettings: (data) => {
    if (!data) throw new Error("Settings data is required");
    return req(`/settings`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Search across all entities
  globalSearch: (query) => {
    if (!query || query.trim() === "") {
      throw new Error("Search query is required");
    }
    return req(`/search${buildQuery({ q: query.trim() })}`);
  },

  // Export data
  exportData: (type = "products", format = "json") => {
    return req(`/export/${type}${buildQuery({ format })}`);
  },

  // Import data
  importData: (type, data) => {
    if (!type || !data) {
      throw new Error("Type and data are required for import");
    }
    return req(`/import/${type}`, {
      method: "POST",
      body: JSON.stringify({ data }),
    });
  },
};

// Add request interceptor for debugging in development
if (import.meta.env.DEV) {
  const originalReq = req;
  window.apiDebug = {
    enableLogging: true,
    logRequests: [],
  };

  // Override req function to add logging
  req = async function (path, options = {}) {
    const startTime = Date.now();

    try {
      const result = await originalReq(path, options);

      if (window.apiDebug?.enableLogging) {
        const duration = Date.now() - startTime;
        const logEntry = {
          path,
          method: options.method || "GET",
          duration,
          success: true,
          timestamp: new Date().toISOString(),
        };
        window.apiDebug.logRequests.push(logEntry);
        console.log(`✅ API [${logEntry.method}] ${path} - ${duration}ms`);
      }

      return result;
    } catch (error) {
      if (window.apiDebug?.enableLogging) {
        const duration = Date.now() - startTime;
        const logEntry = {
          path,
          method: options.method || "GET",
          duration,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
        window.apiDebug.logRequests.push(logEntry);
        console.error(
          `❌ API [${logEntry.method}] ${path} - ${duration}ms - ${error.message}`
        );
      }
      throw error;
    }
  };
}

// Auto flush queue when back online
window.addEventListener("online", () => {
  flushQueue(req).then(({ flushed }) => {
    if (flushed > 0) {
      console.log(`🔄 Flushed ${flushed} queued requests`);
      try {
        window.dispatchEvent(
          new CustomEvent("queue-flushed", { detail: { flushed } })
        );
      } catch (_) {}
    }
  });
});

export default api;
