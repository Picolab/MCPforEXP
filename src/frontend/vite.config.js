import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005, // Moves UI to 3005 to avoid the Pico-Engine on 3000
    host: true, // Exposes the server to the public EC2 IP
    strictPort: true, // Prevents Vite from accidentally picking a different port
    allowedHosts: ["manny.picolabs.io", "engine.picolabs.io"],
    proxy: {
      // Keep your existing proxy settings for local communication on the server
      "/api": {
        target: "https://manny.picolabs.io",
        changeOrigin: true,
        secure: true,
      },
      "/socket.io": {
        target: "https://manny.picolabs.io",
        ws: true,
        secure: true,
      },
    },
  },
});
