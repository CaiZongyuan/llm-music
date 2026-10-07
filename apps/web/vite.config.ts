import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

const target = new URL(process.env.MUSIC_WEB_API_TARGET ?? 'http://127.0.0.1:8000');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.protocol !== 'http:' || target.port === '8188') {
  throw new Error('MUSIC_WEB_API_TARGET must identify a loopback FastAPI service, never Runtime8188');
}
const proxy = { '/api': { target: target.origin, ws: true, rewrite: (path: string) => path.replace(/^\/api/, '') } };

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  server: { host: '127.0.0.1', proxy },
  preview: { host: '127.0.0.1', proxy },
});
