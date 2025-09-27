// backend/server.js
const express = require("express");
const connectDB = require("./config/db");
require("dotenv").config();
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

// Import routes
const productRoutes = require("./routes/productRoutes");
const customerRoutes = require("./routes/customerRoutes");
const billRoutes = require("./routes/billRoutes");
const {
  getSettings,
  updateSettings,
  searchAll,
  exportData,
  importData,
  analyticsOverview,
} = require("./controllers/miscController");

// Import middleware
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

async function startServer() {
  await connectDB();

  const app = express();

  // Middleware
  app.use(cors());
  app.use(helmet());
  app.use(compression());
  app.use(morgan("combined"));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Routes
  app.use("/api/products", productRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/bills", billRoutes);

  // Settings
  app.get("/api/settings", getSettings);
  app.put("/api/settings", updateSettings);

  // Search
  app.get("/api/search", searchAll);

  // Export/Import
  app.get("/api/export/:type", exportData);
  app.post("/api/import/:type", importData);

  // Analytics endpoint
  app.get("/api/analytics/dashboard", async (req, res) => {
    try {
      // Simple analytics endpoint - can be expanded
      res.json({
        message: "Analytics endpoint working",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Basic analytics overview
  app.get("/api/analytics", analyticsOverview);

  // Error handling middleware
  app.use(notFound);
  app.use(errorHandler);

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    server.close(() => {
      console.log("Process terminated");
    });
  });

  return server;
}

module.exports = { startServer };
