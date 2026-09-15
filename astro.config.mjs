import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://humanvsanimal.loicberthod.ch',
  integrations: [vue(), sitemap()],
  build: { format: 'directory' },
});
