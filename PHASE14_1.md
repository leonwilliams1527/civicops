# CivicOps Phase 14.1 — Navigation repair

## Changes
- `/collaboration` shows dashboard metrics and work queue only.
- `/collaboration/projects` shows project requests and request detail/activities.
- `/collaboration/documents` shows department file library.
- `/collaboration/reports` retains spreadsheet intelligence.
- `/collaboration/admin` remains restricted to admins, and its navigation link appears only for admins.
- Removed the misleading “← CivicOps Dashboard” link from the sign-in page and dashboard header.
- All three main routes use the same Supabase session and same underlying collaboration code.

## Deploy
Copy the entire contents of this package into the root of your CivicOps repository, preserving all existing files, then commit and push. No SQL required. Test each navigation tab and browser back button, and verify a non-admin cannot access administrative records.

## QA caveat
Static route and file integrity checked; live Vercel build and browser tests are not run here.
