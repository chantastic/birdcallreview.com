import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://birdcallreview.com',
  trailingSlash: 'ignore',
  build: {
    format: 'file',
  },
});
