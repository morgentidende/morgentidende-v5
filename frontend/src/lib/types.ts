export type SourceMeta = {
  name?: string;
  url: string;
  type?: string;
};

export type Article = {
  id: string;
  slug: string;
  headline: string;
  deck: string | null;
  body_markdown: string;
  category_slug: string;
  category_name: string;
  article_kind: string;
  sagen_kort: string[];
  hero_url: string;
  hero_alt: string;
  hero_credit: string | null;
  published_at: string;
  frontpage_destination: 'lead' | 'theme' | 'special_1' | 'special_2' | 'normal';
  special_label: string | null;
  is_breaking: boolean;
  source_metadata: SourceMeta[];
};

export type SpecialSection = { slot: 1 | 2; title: string; kicker: string | null; active: boolean };
