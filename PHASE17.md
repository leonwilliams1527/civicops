# CivicOps Phase 17 — Connected Project Reporting

## Purpose
Keep the validated Phase 11 spreadsheet records separate from live requests, while showing relevant cross-department requests alongside each imported project by matching the exact Project ID (case-insensitive, trimmed). Existing Supabase RLS filters which requests a user can view.

## What's new
- **Reports → Department reporting** includes a **Requests** count and **View project** action.
- A project overview shows status, progress, target date, responsible team, and accessible related requests.
- **Open request** navigates to `/collaboration/projects?request=<uuid>` and uses the Phase 16.1 deep link.
- Existing spreadsheet import and admin/assignment functionality remains in place.

## Deploy
1. Extract the ZIP and copy the contents into your existing GitHub repository root, preserving folder structure.
2. Commit and push to `main`. Wait for Vercel Ready.
3. Open Reports and select an imported project (e.g. BMAP-101).
4. Create a fictional request with exactly the same Project ID if none exists; return to Reports and refresh.
5. Click **View project → Open request**. Verify it opens the correct request.
6. Sign in as a user from another department and confirm they cannot view inaccessible project records or requests.

**No new SQL migration is required.** This is a read-only association, not a permanent foreign-key relationship. If multiple spreadsheet imports contain the same Project ID, each imported row will show the same matching requests. This is intentional for the pilot, but should be reconciled before production. Do not use sensitive operational data for pilot testing.
