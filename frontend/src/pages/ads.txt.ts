import { ADSENSE_CLIENT } from '../lib/adsense';

export const prerender = false;

export const GET = () => {
  const match = /^ca-(pub-\d{16})$/.exec(ADSENSE_CLIENT);
  if (!match) return new Response('Not configured\n', { status: 404 });

  return new Response(`google.com, ${match[1]}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
