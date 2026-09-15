import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';

// Remplace par ton vrai domaine avant la mise en ligne.
export default defineConfig({
  site: 'https://humanvsanimal.loicberthod.ch',
  integrations: [vue(), sitemap()],
  build: { format: 'directory' },
});
