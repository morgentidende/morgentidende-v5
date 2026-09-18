import { getSupabase } from '../lib/supabase';

const base = 'https://morgentidende.dk';

function xmlEscape(value: string) {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('v5_public_articles')
    .select('slug,published_at')
    .order('published_at', { ascending: false });

  if (error) {
    return new Response('Sitemap unavailable', { status: 503 });
  }

  const staticUrls = [
    '/',
    '/kategori/indland',
    '/kategori/udland',
    '/kategori/penge',
    '/kategori/kultur',
    '/kategori/tema',
    '/kategori/viden',
    '/kategori/liv',
    '/om-morgentidende',
    '/redaktionelle-principper',
    '/kontakt',
    '/privatliv'
  ];

  const entries = [
    ...staticUrls.map((path) => ({ loc: base + path, lastmod: null as string | null })),
    ...(data ?? []).map((article) => ({
      loc: base + '/artikel/' + article.slug,
      lastmod: article.published_at ? new Date(article.published_at).toISOString() : null
    }))
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(({loc,lastmod}) => `  <url>
    <loc>${xmlEscape(loc)}</loc>${lastmod ? `
    <lastmod>${xmlEscape(lastmod)}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=900'
    }
  });
}
