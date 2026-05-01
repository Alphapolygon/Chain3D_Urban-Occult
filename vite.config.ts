import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Chain3D_Urban-Occult/',
  server: { port: 5173 }
});
