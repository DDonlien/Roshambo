import { defineConfig } from 'vite';

export default defineConfig({
  // itch.io requires relative paths to load assets properly when hosted in an iframe
  base: './',
});
