import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import apiApp from './api/index.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'express-api-middleware',
      configureServer(server) {
        server.middlewares.use(apiApp);
      }
    }
  ],
  server: {
    port: 3000
  }
});
