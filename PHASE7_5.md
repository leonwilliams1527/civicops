# CivicOps Phase 7.5 — Profiles and collaboration interface

## Deploy (keep existing Supabase project and Vercel environment variables)

1. In **CivicOps-Production → SQL Editor**, run `supabase/phase7_5.sql`. This grants authenticated users permission to update their own `designation` and `updated_at` columns in addition to `full_name`. The existing user-owned RLS policies remain in place.
2. Deploy the complete ZIP as the new version of your existing CivicOps application. Do not upload SQL to Vercel separately and do not reset Supabase.
3. Sign in as Water Quality and save a full name and designation. Refresh and verify they persist.
4. Sign in as Permitting in a separate private browser session; save a different full name and designation.
5. Post a comment and change request status as Permitting. Verify the Water Quality activity history displays the actual author name, designation, department, and timestamp.
6. Test recent vs older activity, request filters, creation, refresh persistence, and mobile layout.

## Notes

- Historical events retain the recorded actor_id. Once that actor saves a profile, the display can show their current name/designation. Historic designations are not snapshotted at event time.
- Department attribution is taken from `request_activity.actor_department` (server-side trigger), not from editable profile fields.
- If Save profile fails, the UI now shows the Supabase error message. Do not assume success until it confirms and the value survives refresh.
- This is a pilot, not an official municipal system. Security and authorization review are still required before use with sensitive data.
- Existing Supabase proxy routes, session authentication, request status audit trigger, and 10-second polling are preserved.
