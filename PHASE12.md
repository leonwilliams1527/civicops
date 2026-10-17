# CivicOps Phase 12 — Pilot Administration & Audit

## Deploy
1. Back up your current repository. Copy **all files inside this package** to the repository root, retaining the `app/layout.js` file.
2. In Supabase SQL Editor, run `supabase/phase12.sql` after Phase 11. It adds an audit table and two triggers; it does not reset existing data.
3. Commit and push to GitHub; wait for Vercel to show Ready.
4. Sign in with an existing admin account and visit `/collaboration/admin`.

## QA
- Admin: view read-only request counts and recent audit events.
- Member: `/collaboration/admin` must show Administrator access required and must not retrieve audit data.
- Change a request status and refresh the admin page: an audit event should appear.
- Import a fresh fictional spreadsheet and refresh: a spreadsheet.imported event should appear.
- Verify Water Quality-only records are invisible to Permitting, including direct file downloads.

## Boundaries
This is a pilot administration foundation, **not** a production security certification. It does not manage roles, add SSO, backfill historical audit events, or enable scheduled jobs or Resend. Audit entries are inserted by database triggers and cannot be edited by authenticated users. Existing database access policies still govern the operational data.
