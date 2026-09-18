# Morgentidende v5

Clean-slate implementation. V5 does not import V3/V4 implementation code.

## Principle

**No part is the best part.**

There is one semantic editorial owner. V5 does not add secondary editorial agents, backend semantic QA, semantic dedupe services, release runners, watchdogs or queues around editorial decisions.

Runtime shape:

`V5 Scheduler -> V5 Editorial AI -> one technical hero ingest -> v5_publish_article() -> V5 Supabase -> V5 Astro frontend`

After successful publication the same editorial run may schedule Facebook/Instagram through the connected Metricool account. Social distribution never blocks publication.

## Single sources of truth

- `docs/v5-editorial.md` — all editorial policy.
- `docs/v5-engine-prompt.md` — the one editorial engine prompt.
- `docs/v5-discovery-sources.md` — discovery data only. Legacy workflow logic is not imported.

## Backend

Dedicated Supabase project: `morgentidende v5` (`wmyoplpweamkflbtvqid`, eu-central-1).

The database uses only V5-prefixed editorial tables/functions. The publication function owns only atomicity/idempotency and lead handoff. It does not perform semantic QA or dedupe.

Hero ingestion is one deterministic technical implementation. Remote photos and inline/generated image bytes both pass through the same `v5-hero-ingest` Edge Function. The database entrypoints only create one-time capabilities and dispatch bytes/URLs; they make no editorial decisions.

Newsletter signup/confirmation/preferences use one Edge Function and opaque per-subscriber tokens. Amazon SES credentials are the only external server secret required for newsletter mail.

## Frontend

Astro + Cloudflare adapter, implemented in V5. It may reuse proven product/design ideas, but it must not import or depend on V3/V4 runtime code, Supabase projects, Workers, prompts or operational flows.

## Isolation

V4 is frozen historical/reference material only. No new feature, fix, advertising integration or operational dependency belongs in V4.

V5 has its own repository, Supabase project and Cloudflare Worker. V5 is the only active development target for Morgentidende.
