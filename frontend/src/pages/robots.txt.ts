export const GET = () => new Response(
`User-agent: *
Allow: /

Sitemap: https://morgentidende.dk/sitemap.xml
`,
{ headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } }
);
