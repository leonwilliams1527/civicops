# Phase 22.1.1 — Invitation administrator lookup diagnostics

This correction distinguishes a failed service-role membership query from a missing membership and from an ordinary non-admin login. It does not grant privileges or weaken any policy.

1. Deploy this complete folder as a replacement for Phase 22.1. **No new SQL is required.**
2. Confirm `SUPABASE_SERVICE_ROLE_KEY` in Vercel is the legacy Supabase `service_role` key for the **same project** as `NEXT_PUBLIC_SUPABASE_URL`. Keep it server-only. Redeploy.
3. Sign in as the original Water Quality Super Admin, open Administration → Invite Employee.
4. If the page still shows an error, capture the exact new error message including its code, and check Vercel Function Logs for the corresponding `CivicOps invitations` error. Never share secrets or access tokens.
5. If it says `membership_missing`, compare the currently signed-in Auth user ID with the known owner UUID. If it says `membership_query_error` or a PostgREST code, check the service-role key and database permissions.
6. After successful loading, verify the six departments and Employee/Department Admin options. Then test a fictional invite.

This is a diagnostic fix: the existing backend permission check remains mandatory.
