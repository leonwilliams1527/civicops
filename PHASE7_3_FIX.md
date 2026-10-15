# CivicOps Phase 7.3 — Authentication proxy repair

## Root issue
The previous deployment's sign-in attempt received an HTML document instead of a JSON response. The original proxy path used a nested catch-all API route; the supplied screenshots do not prove exactly why it returned HTML. This update uses a dedicated fixed API route (`/api/supabase-proxy`) with an explicit, validated upstream path, and improves the browser's error message when an unexpected response is received.

## Deployment
Upload all project files to the existing Vercel project, retaining the current `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` settings. No Supabase schema or account changes are needed. Redeploy to Production.

## QA
1. Check `/api/supabase-health` returns `{ "ok": true, "upstreamStatus": 200 }`.
2. Check `/api/supabase-proxy?path=%2Fauth%2Fv1%2Fhealth` returns Supabase JSON, not HTML. This is the key new proxy test.
3. Log in to `/collaboration` with the new Water Quality admin account; verify role and department.
4. Sign in with the Permitting user in a separate browser profile and test creation, status changes, activity, and persistence after refresh.
5. Verify users cannot access requests outside their authorized departments; audit RLS policies before real city data.

This release has not been live-tested against your Vercel/Supabase accounts. It is for pilot use only.
