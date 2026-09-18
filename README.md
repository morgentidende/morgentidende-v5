# Morgentidende v5

Clean-slate implementation. V5 does not import V3/V4 implementation code.

## Principle

**No part is the best part.**

Runtime shape:

`V5 Scheduler -> V5 Editorial AI -> v5_ingest_hero() -> v5_publish_article() -> V5 Supabase -> V5 Astro frontend`

After successful publication the same editorial run may schedule Facebook/Instagram through the connected Metricool account. Social distribution never blocks publication.

## Single sources of truth

- `docs/v5-editorial.md` — all editorial policy.
- `docs/v5-engine-prompt.md` — the one editorial engine prompt.
- `docs/v5-discovery-sources.md` — discovery data only; 149 sources copied from V4 without V4 workflow logic.

## Backend

Dedicated Supabase project: `morgentidende v5` (`wmyoplpweamkflbtvqid`, eu-central-1).

The database uses only V5-prefixed editorial tables/functions. The publication function owns only atomicity/idempotency and lead handoff. It does not perform semantic QA or dedupe.

Hero ingestion is one deterministic technical helper. Each request is authenticated with a one-time random capability generated inside Postgres; there is no permanent hero-ingest token.

Newsletter signup/confirmation/preferences use one Edge Function and opaque per-subscriber tokens. Amazon SES credentials are the only external server secret required for newsletter mail.

## Frontend

Astro + Cloudflare adapter, written from scratch. Includes masthead + light/dark + search, news bar, lead/breaking, front-page tiers, two optional Specialredaktion slots, Viden and Liv, latest news, newsletter, article/category/search/static pages and footer.

No Livecenter exists in V5. A future live format is intentionally ad hoc rather than part of the core.

## Isolation / rollback

V4 remains untouched and live. A frozen Git branch exists as `v4-frozen-2026-09-18`.

V5 has its own repository, own Supabase project and will have its own Cloudflare Worker/project. Do not copy V4 implementation code into V5.
