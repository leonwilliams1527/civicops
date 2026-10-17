# CivicOps Phase 13 — Scheduled notifications and optional Resend delivery

This is a **full application package** based on Phase 12.1. No Supabase data reset is required.

## Installation
1. Back up the current repository and Supabase database. Confirm Phase 12.1 is already working.
2. Run `supabase/phase13.sql` once in Supabase SQL Editor.
3. Copy **all** files from this package into the GitHub repository root; preserve `app/layout.js`. Commit and push.
4. Set the following **server-only** Vercel environment variables (never prefix them with `NEXT_PUBLIC_`): `CRON_SECRET` (long random secret), `SUPABASE_SERVICE_ROLE_KEY`. Retain existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Set `CIVICOPS_AUTOMATION_ENABLED=false` initially. The Vercel Cron route is installed but returns a disabled response.
6. Verify Vercel deployment shows Ready. To activate deadline checks after validating the Phase 10 recipient rules, set `CIVICOPS_AUTOMATION_ENABLED=true` and redeploy. The cron runs daily at **13:00 UTC**. Vercel cron plan limits may apply.
7. **Optional Resend activation only when approved:** verify a sender domain in Resend; set `RESEND_API_KEY`, `CIVICOPS_EMAIL_FROM` (e.g., `CivicOps <alerts@your-verified-domain.example>`), and `CIVICOPS_EMAIL_ENABLED=true`. Redeploy. Until then, leave `CIVICOPS_EMAIL_ENABLED=false`.

## QA
- With automation disabled, verify `/api/cron/civicops-notifications` returns HTTP 401 without the `Authorization: Bearer <CRON_SECRET>` header. A valid header returns `disabled:true`.
- After enabling, inspect the in-app notifications and `request_reminder_log` for correct recipients and no duplicate same-day reminders.
- Verify Water Quality-only documents and spreadsheet records remain inaccessible to Permitting.
- Before enabling email, inspect the pending queue and use test accounts. Confirm user opt-out preferences and Resend domain.
- Verify the outbox transitions `pending → processing → sent`, or `failed` with a retry delay.

## Operational cautions
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS: **never put it in client code or a public GitHub file**.
- The endpoint is protected by `CRON_SECRET`. The cron configuration will invoke it on schedule, but it does nothing while disabled.
- The email queue is processed in batches of 10 per daily invocation. A larger production volume requires more frequent processing or a separate worker.
- The existing Phase 10 reminder logic records at most one reminder per request/category/day. It does not distinguish timezone-specific business hours.
- The sender is not activated automatically; no email is sent until `CIVICOPS_EMAIL_ENABLED=true` and valid Resend credentials are configured.
- No production deployment or real email delivery has been verified in this environment.
