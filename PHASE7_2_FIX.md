# CivicOps Phase 7.2 — Supabase health-check correction

## Root cause
The Phase 7.1 health endpoint called `/auth/v1/health` without an `apikey` header. Supabase's API gateway returned HTTP 401, which the app displayed as a connection failure even before sign-in.

## Changes
- Health check now supplies the configured public Supabase key in the `apikey` header.
- For legacy JWT anon keys only, health check also supplies a Bearer authorization header.
- Explicit diagnostic for missing environment variables or rejected API key; no key values returned to the browser.
- Proxy has a fallback for missing `apikey` request headers.
- No database schema or UI features changed.

## Deploy
Upload this ZIP's contents to the existing Vercel CivicOps project. Confirm Production environment variables `NEXT_PUBLIC_SUPABASE_URL` (base URL only, without `/rest/v1/`) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (new project's publishable key). Redeploy and open `/api/supabase-health`.

## QA sequence
1. Health endpoint returns `{ "ok": true, "upstreamStatus": 200 }` (or another successful 2xx upstream status).
2. Sign in as Water Quality admin and confirm department membership.
3. Sign in separately as Permitting member and confirm department membership.
4. Create a test request from Water Quality to Permitting, confirm visibility in both sessions.
5. Update its status from Permitting and verify visibility in Water Quality.
6. Test unauthorized cross-department access and RLS before adding any real operational data.

Do not use service_role/secret keys in `NEXT_PUBLIC_` variables. This remains a pilot, not a production-approved government system.
