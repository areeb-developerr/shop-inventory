const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  printHTML: (html) => ipcRenderer.invoke("print-html", html),
});
