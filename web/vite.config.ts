import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// server.host = true faz o Vite ouvir em 0.0.0.0 (celular acessa por IP-do-PC:5173).
// O app usa chamadas na mesma origem (window.location.origin); em dev pelo Vite,
// o proxy encaminha /api (inclui o SSE de /api/events) para o servidor na 3000.
// No app empacotado tudo já vem da 3000, então o proxy não é usado.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
