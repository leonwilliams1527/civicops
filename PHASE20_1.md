# Phase 20.1 — Secure Cross-Department Project Sharing

## Deploy
1. Back up the database and run `supabase/phase20_1.sql` in Supabase SQL Editor after Phase 20.
2. Deploy the complete application directory to the existing GitHub/Vercel project.
3. Sign out and back in to refresh the UI.

## What changes
- A department with at least one assigned milestone gains read access to that imported **project row** and its milestone/audit records. The project owner keeps control of its original import.
- **Reports → Shared Projects** lists those accessible project rows. **Department reporting** and **Import history** continue to reflect only the signed-in department's own imports.
- The existing Phase 20 milestone RPC continues to restrict changes to the project lead admin or owning department admin; an owning department admin may only change the milestone owner and status.
- No cross-department permission to upload, modify or delete the original imported spreadsheet is added.
- Revoking the last milestone assignment to a department removes that department's shared project visibility immediately (subject to open browser tabs refreshing).

## Security boundary
Shared departments can see the imported project **row's fields**, including estimated cost, progress, target date and latest update. They do **not** receive the original spreadsheet file or import history. Existing request/activity/attachment RLS still applies independently. Do not place confidential department-only fields in a project row you intend to share. For stricter field-level disclosure, a future curated shared-project view is required.

## QA
1. Water Quality: BMAP-101 appears under Department reporting and has Permitting Review owned by Permitting.
2. Permitting: BMAP-101 appears under **Shared Projects**; open workspace and assign the milestone to a Permitting employee; set status In Progress.
3. Water Quality: see the updated owner/status and milestone audit history.
4. Permitting: cannot see other Water Quality projects without a Permitting-owned milestone; cannot see Water Quality import history.
5. Permitting: cannot edit milestone title, date, or department; test database rejects such an RPC attempt.
6. Other department: cannot see BMAP-101 without an assigned milestone.
7. Remove/reassign the only Permitting milestone (as Water Quality admin) and verify Permitting loses access.

Live database permissions and deployment have not been verified here. Use fictional data for pilot testing.
