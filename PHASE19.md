# CivicOps Phase 19 — Project Activity & Workload Visibility

## Included
- Project workspace now displays a read-only timeline of recent request updates, with employee names and direct request links.
- Related requests can be filtered by all, unassigned, active, and completed, and searched by title, department or owner.
- Existing Phase 18 workspace, permissions, assignments, notifications, imports and document handling remain unchanged.
- Project activity is limited to the latest 300 accessible request-activity rows for up to 500 accessible related requests. It is not a complete audit export.

## Deployment
1. Download and extract ZIP. Copy the **contents** into the existing GitHub repository, preserving paths.
2. Commit and push to main. Wait for Vercel Ready.
3. Reports → BMAP-101 → Open workspace. Verify the linked request appears.
4. Post a test update on the linked request, then refresh the workspace and check the activity timeline.
5. Test Unassigned and Active filters, search, and click a timeline request link.
6. Sign in as a different department user and verify only authorized requests and updates are visible.

**No Supabase migration.** This release is read-only. The live production build and authorization checks must be verified after deployment.
