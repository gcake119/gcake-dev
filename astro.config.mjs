import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

export default defineConfig({
  site: 'https://gcake119.github.io',
  base: '/gcake-dev',
  output: 'static',
  integrations: [vue()],
});
