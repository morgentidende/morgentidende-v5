import { getSupabase } from './supabase';
import type { Article, SpecialSection } from './types';

export async function loadFrontpage() {
  const supabase = getSupabase();
  const [{ data: articles, error: aErr }, { data: specials, error: sErr }] = await Promise.all([
    supabase.from('v5_public_articles').select('*').order('published_at', { ascending: false }).limit(40),
    supabase.from('v5_public_special_sections').select('*').eq('active', true).order('slot'),
  ]);
  if (aErr) throw aErr;
  if (sErr) throw sErr;
  const all = (articles ?? []) as Article[];
  return {
    articles: all,
    lead: all.find((a) => a.frontpage_destination === 'lead') ?? all[0] ?? null,
    normal: all.filter((a) => a.frontpage_destination === 'normal'),
    viden: all.filter((a) => a.category_slug === 'viden').slice(0, 4),
    liv: all.filter((a) => a.category_slug === 'liv').slice(0, 4),
    specials: (specials ?? []) as SpecialSection[],
  };
}

export async function loadLatestHeadline() {
  const { data, error } = await getSupabase()
    .from('v5_public_articles')
    .select('slug,headline')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as { slug: string; headline: string } | null;
}

export async function loadArticle(slug: string) {
  const { data, error } = await getSupabase().from('v5_public_articles').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data as Article | null;
}

export async function loadCategory(category: string) {
  const { data, error } = await getSupabase().from('v5_public_articles').select('*').eq('category_slug', category).order('published_at', { ascending: false }).limit(40);
  if (error) throw error;
  return (data ?? []) as Article[];
}

export async function searchArticles(q: string) {
  if (!q.trim()) return [];
  const { data, error } = await getSupabase().rpc('v5_search_articles', { p_query: q.trim(), p_limit: 40 });
  if (error) throw error;
  return (data ?? []) as Article[];
}
