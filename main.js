const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const isDev = !app.isPackaged;

// start backend server
require("dotenv").config();
const { startServer } = require("./backend/server");

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    backgroundColor: "#111827",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false, // Explicitly set for security
      enableRemoteModule: false,
      webSecurity: true,
    },
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent white screen flash
  win.once("ready-to-show", () => {
    win.show();
    if (isDev) {
      win.webContents.openDevTools();
    }
  });

  if (isDev) {
    // Development: load Vite dev server
    win.loadURL("http://localhost:5173");
  } else {
    // Production: load built index.html
    const indexPath = path.join(__dirname, "dist", "index.html");
    console.log("Loading production file from:", indexPath);

    win.loadFile(indexPath).catch((err) => {
      console.error("Failed to load index.html:", err);
      // Fallback: try alternative path
      const fallbackPath = path.join(
        process.resourcesPath,
        "app",
        "dist",
        "index.html"
      );
      console.log("Trying fallback path:", fallbackPath);
      win.loadFile(fallbackPath);
    });
  }

  // Debug: Log when page fails to load
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Page failed to load:", errorCode, errorDescription);
  });
}

app.whenReady().then(async () => {
  // Create window immediately for faster perceived startup
  createWindow();
  // Start backend server in background to avoid blocking UI show
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Print raw HTML (for invoices)
ipcMain.handle("print-html", async (_event, html) => {
  const child = new BrowserWindow({ show: false });
  await child.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(html)
  );
  return new Promise((resolve, reject) => {
    child.webContents.print({}, (success, failureReason) => {
      child.close();
      if (success) resolve(true);
      else reject(failureReason);
    });
  });
});
