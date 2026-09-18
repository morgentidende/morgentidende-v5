import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://v5.morgentidende.dk',
  output: 'server',
  adapter: cloudflare(),
});
