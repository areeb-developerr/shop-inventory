import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: "stats.html", brotliSize: true, gzipSize: true, open: false }),
  ],
  server: { port: 5173 },
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "dist"), // stays in project root
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          lucide: ["lucide-react"],
          vendors: ["dexie"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "dexie", "lucide-react"],
  },
});
