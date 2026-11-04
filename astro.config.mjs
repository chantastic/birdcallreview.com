import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'http://birdcallreview.com',
  trailingSlash: 'ignore',
  build: {
    format: 'file',
  },
});
