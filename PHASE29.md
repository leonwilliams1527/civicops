# Phase 29 — Safe access verification diagnostics

## Changes
- The User Access Management endpoint now identifies which database authorization lookup failed, using only table names and PostgreSQL error codes. No raw database messages or secrets are returned to the browser.
- The interface displays those diagnostic codes so the owner can identify whether the deployed service-role configuration or an expected table is missing.
- All authorization checks remain fail-closed. Existing RLS, owner trigger, invitations, GIS, and other features remain unchanged.

## Deploy
1. Deploy this package using the same Vercel environment variables as Phase 28.
2. Sign in as the verified owner and open `/collaboration/access-management`.
3. If access verification still fails, capture the table name and error code displayed. `42P01` typically means missing table; `42501` means insufficient privilege. Check that `SUPABASE_SERVICE_ROLE_KEY` belongs to the same Supabase project as `NEXT_PUBLIC_SUPABASE_URL`. Never share the secret key.
4. If the page loads, confirm the owner badge and employee directory.

## Not yet enabled
Privilege editing, suspension, and cross-department pilot access require an additional migration and server-side authorization review. Do not rely on a UI-only toggle or broad existing `is_pilot_admin()` function for these features.
