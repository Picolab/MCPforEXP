import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005, // Moves UI to 3005 to avoid the Pico-Engine on 3000
    host: true, // Exposes the server to the public EC2 IP
    strictPort: true, // Prevents Vite from accidentally picking a different port
    proxy: {
      // Keep your existing proxy settings for local communication on the server
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
