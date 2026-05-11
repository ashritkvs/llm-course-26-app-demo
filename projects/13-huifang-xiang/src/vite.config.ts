import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// Plugin to copy static files to dist
const staticFilesPlugin = () => ({
  name: 'static-files',
  closeBundle() {
    const distDir = resolve(__dirname, 'dist');
    const publicDir = resolve(__dirname, 'public');

    // Ensure public directory exists in dist
    const distPublic = resolve(distDir, 'public');
    if (!existsSync(distPublic)) {
      mkdirSync(distPublic, { recursive: true });
    }

    // Copy manifest.json
    copyFileSync(
      resolve(__dirname, 'manifest.json'),
      resolve(distDir, 'manifest.json')
    );

    // Copy icons if they exist
    const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
    icons.forEach(icon => {
      const src = resolve(publicDir, icon);
      if (existsSync(src)) {
        copyFileSync(src, resolve(distPublic, icon));
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), staticFilesPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        options: resolve(__dirname, 'options.html'),
        background: resolve(__dirname, 'src', 'background.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          return '[name].js';
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
