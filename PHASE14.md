# Phase 14 — Unified CivicOps Navigation

## Changes
- The `/` route redirects to the live `/collaboration` dashboard, removing the separate hardcoded John Doe / BMAP demonstration homepage.
- A shared navigation bar on the authenticated collaboration dashboard links to real project requests, department files, spreadsheet reporting, notifications, account settings, and administration (admin role only).
- Existing Supabase login/session, Phase 12.1 admin role management, reports, attachments, and Phase 13 notification code are retained.
- No new database migration is required.

## Deploy
1. Extract the ZIP. Copy the **contents** of `app-source` into your repository root, preserving directories and existing `.env` secrets.
2. Commit and push to `main`. Confirm Vercel Root Directory points to the repository root.
3. Test `/`, `/collaboration`, `/collaboration/reports`, and `/collaboration/admin`.
4. Sign in as an admin and as a regular member: admin should see Administration; member should not. Test server-side access separately.
5. Confirm real profile appears and no John Doe / demo BMAP metrics remain on the home page.

## Notes
- This is a navigation and homepage consolidation. Admin and Reports still use their existing page layouts; a fully persistent shared sidebar across every route is not implemented here.
- Phase 13 notification migrations and delivery activation are separate tasks; do not enable Resend until recipients and permissions have been tested.
- This package was statically checked but not deployed or tested against your live Supabase database.
