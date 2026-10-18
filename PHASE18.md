# CivicOps Phase 18 — Dedicated Project Workspace

## What's new
- Reports **Open workspace** navigates to a dedicated `/collaboration/project/<project UUID>` page.
- Shows imported project overview, lead department, responsible team, imported target date/progress, and related requests.
- Shows request-attached document names with links back to the relevant request for authorized access.
- Shows requester and assigned employee names when profiles are available.
- Preserves request deep linking and the current department admin assignment workflow.

## Deployment
1. Copy all extracted application files into the existing CivicOps repository, preserving paths.
2. Commit and push to `main`; wait for Vercel **Ready**.
3. Reports → BMAP-101 → **Open workspace**.
4. Verify the BMAP-101 request appears, then **Open request**.
5. Verify the Permitting employee assignment remains visible.
6. Add a test attachment to that request, refresh the project workspace, and verify its name appears; open it through the request.
7. Sign in to a different department and verify unauthorized records are not visible.

**No new Supabase migration is required.** The workspace is read-only and matches requests by existing Project ID. Imported progress and target date are not editable milestones. Project documents are request attachments, not a new independent project file store. Live Vercel build and permissions testing are still required.
