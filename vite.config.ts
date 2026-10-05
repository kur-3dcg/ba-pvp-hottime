import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.PAGES_BASE_PATH || "/",
  server: { port: 5173, strictPort: true },
  // Preserve hashed assets requested by an already-open local preview.
  build: { chunkSizeWarningLimit: 1800, emptyOutDir: false, license: true },
});
