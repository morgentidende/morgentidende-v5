export const prerender = false;

export const GET = () => {
  const client = import.meta.env.PUBLIC_ADSENSE_CLIENT || '';
  const match = /^ca-(pub-\d{16})$/.exec(client);
  if (!match) return new Response('Not configured\n', { status: 404 });
  return new Response(`google.com, ${match[1]}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
