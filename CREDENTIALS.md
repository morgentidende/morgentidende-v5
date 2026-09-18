# V5 credentials — minimum

## No secret required

- Supabase frontend publishable key: public and baked into the V5 frontend.
- Supabase URL: public and baked into the V5 frontend.
- Hero ingest: no permanent token. Postgres creates a one-time capability for each image request.
- Metricool: use the existing connected Morgentidende integration in ChatGPT; do not create a new API token for the editorial run.
- GitHub: use the existing ChatGPT GitHub connection after the V5 repository exists.
- Cloudflare: prefer Cloudflare's GitHub integration for deploys instead of creating a new deploy token.

## Existing secret to reuse

V5 newsletter mail needs the same Amazon SES IAM credentials already used for Morgentidende:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- optional `AWS_SESSION_TOKEN` when temporary credentials are used

Configuration defaults:

- region: `eu-north-1`
- sender: `Morgentidende <nyhedsbrev@morgentidende.dk>`

Do not commit these values to GitHub. They belong only in V5 Supabase Edge Function secrets.
