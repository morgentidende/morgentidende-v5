import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://morgentidende.dk',
  output: 'server',
  adapter: cloudflare(),
});
