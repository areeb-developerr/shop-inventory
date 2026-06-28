const path = require("path");
const { app, BrowserWindow } = require("electron");
const { registerIpc } = require("./electron/ipc");
const { initDb } = require("./electron/db/index");
const reports = require("./electron/db/reports");
const sync = require("./electron/db/sync");
const { getSetting } = require("./electron/db/index");

const isDev = !app.isPackaged;
let win = null;
let reportCheckInterval = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  win.once("ready-to-show", () => {
    win.show();
    if (isDev) win.webContents.openDevTools({ mode: "detach" });
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  }
}

function startAutoReport() {
  if (reportCheckInterval) clearInterval(reportCheckInterval);
  reportCheckInterval = setInterval(() => {
    if (getSetting("autoReportEnabled") !== "true") return;
    const time = getSetting("autoReportTime", "21:00");
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (hhmm === time) {
      const today = now.toISOString().slice(0, 10);
      const existing = initDb().prepare("SELECT id FROM daily_reports WHERE date = ?").get(today);
      if (!existing) {
        reports.generate(today);
        sync.pushNow().catch(() => {});
      }
    }
  }, 60 * 1000);
}

app.whenReady().then(() => {
  registerIpc();
  initDb();
  sync.startAutoSync();
  startAutoReport();
  createWindow();
});

app.on("window-all-closed", () => {
  sync.stopAutoSync();
  if (reportCheckInterval) clearInterval(reportCheckInterval);
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
