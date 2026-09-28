import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://gcake119.github.io',
  base: '/gcake-dev',
  output: 'static',
  integrations: [mdx(), vue()],
  markdown: { shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } } },
});
