import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const host = context.url.hostname.toLowerCase();

  if (host.endsWith('.workers.dev')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
});
