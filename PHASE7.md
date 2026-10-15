# CivicOps Phase 7 — Cloud Collaboration Pilot

This release preserves Phase 6 (all existing water quality, mapping, BMAP, project, credit, monitoring, planning, reporting and local demonstration pages) and adds `/collaboration`.

## Deploy
1. Unzip and upload the **contents** (not the enclosing folder) to your existing `leonwilliams1527/civicops` GitHub repository. Replace `app/page.js`, `package.json`, and add `app/collaboration/page.js`, `supabase/phase7.sql` and this document. Keep `app/layout.js` and `app/globals.css`.
2. Create a new Supabase project you control. In its SQL Editor run `supabase/phase7.sql` once. This creates tables, row-level access policies and change subscriptions.
3. In Supabase Project Settings → API, copy **Project URL** and **publishable/anon key** (NEVER the service-role key).
4. In Vercel → Project → Settings → Environment Variables, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with those values, then redeploy.
5. Open `/collaboration` and sign up. In Supabase Authentication → Users copy your user UUID. In SQL Editor execute:
   `insert into public.memberships(user_id,department,role) values ('YOUR_UUID','Water Quality','admin');`
6. Add a second pilot user through the sign-up page and assign them `Permitting` with role `member` using the same SQL template. Sign in with separate browsers to test cross-account updates.

## What is real
- Authenticated user accounts, Supabase-persisted requests and activity, department-scoped access, status changes by receiving department, live refresh via Realtime.
- The legacy Phase 6 browser demonstration remains separate and unchanged. Its requests are NOT automatically migrated.

## What is not yet implemented
- Automated email/SMS reminders, OneDrive/SharePoint sync, spreadsheet conflict resolution, individual employee assignment, server-side immutable audit logs, production security review.
- The prototype dataset is not City of Fort Myers or DEP verified information. Do not upload protected government information or real personnel records to this pilot.

## QA
- Sign up with no membership: access blocked.
- Water Quality creates a request for Permitting: both departments can see it.
- Permitting can change status, Water Quality cannot change status.
- A GIS user cannot see that request.
- Request comments are visible only to authorized departments.
- Refreshing and switching browsers retains the shared data.
