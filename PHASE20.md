# CivicOps Phase 20 — Project Milestones & Accountability

## Deploy in this order
1. Back up your Supabase project schema and data. In Supabase SQL Editor run `supabase/phase20.sql` **once**. It adds `project_milestones`, `project_milestone_audit`, their row-level security policies, and the controlled `civicops_milestone_save` RPC.
2. Extract this ZIP, copy **all application files** to the existing CivicOps GitHub repository (keep existing paths), commit, and push to `main`.
3. Wait for Vercel **Ready** and sign in again if necessary.
4. Open **Reports → BMAP-101 → Open workspace → Project milestones**.

## Behavior
- A project lead-department admin can create milestones and change their scope, dates, department, owner and status.
- An admin in the milestone's assigned department can update the employee owner and status, but cannot change scope, date, title, or department.
- All edits use a Supabase RPC that verifies membership and role server-side. Read access inherits project visibility from `spreadsheet_projects` RLS.
- The audit log records milestone creation and changes. No direct table writes are granted to authenticated users.
- Overdue milestones are marked in the project workspace; completion timestamps are recorded.
- Imported project progress remains separate from milestone completion; it is not silently recalculated.
- No email alerts or scheduled escalation are introduced in Phase 20 (planned for Phase 22).

## Test checklist
1. As Water Quality admin, create a BMAP-101 milestone with Permitting as owner department and a future due date.
2. As Permitting admin, assign a Permitting employee and set status to In Progress. Confirm the change appears after refresh and in milestone history.
3. As Permitting admin, attempt to change the milestone's due date: the field should be disabled and the database must reject unauthorized changes.
4. As a normal employee, verify no Create/Edit controls appear; read only permitted project milestones.
5. Create an overdue milestone and verify the overdue label; set it Completed and verify the label clears.
6. Verify existing related requests, project activity, attachments, dashboards, and notifications still work.

**Important:** A migration is required for this phase. The ZIP has been packaged but a live Supabase/Vercel integration test must be completed after deployment.
