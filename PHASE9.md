# CivicOps Phase 9 — Department Task Management

## New capabilities
- My work queue: Assigned to me, Needs an owner, Due within 3 days.
- Queue filters: Assigned to us, Assigned to me, Unassigned, Awaiting other departments, Overdue, Due soon.
- Request priority: Low, Normal, High, Urgent.
- Assign a specific employee within the receiving department.
- Due date and priority sorting.
- Database validation prevents assigning a request to an employee from a different department.

## Deployment
1. **Before this release, finish verifying Phase 8.3**: its corrected SQL must have run successfully. Do not assume notifications work merely because the application loads.
2. In CivicOps-Production SQL Editor, run the entire `supabase/phase9.sql`. It does not reset data.
3. Extract the ZIP into your GitHub Desktop local clone of CivicOps, preserving nested folders; commit and push to `main`.
4. Wait for Vercel deployment to succeed.

## QA
1. Water Quality sees existing requests, documents and profile intact.
2. Permitting sees `Assigned to us` and `Unassigned` for existing open requests.
3. Permitting chooses a team member as owner and sets High priority; refresh and verify both persist.
4. Water Quality sees the updated owner/priority but cannot edit them unless authorized by existing RLS.
5. Try selecting an employee from a different department via direct API (security review) and verify the database rejects it.
6. Confirm overdue and due-soon queues only include relevant incomplete requests.
7. Verify notification triggers after Phase 8.3 migration is fixed, and verify files and status changes still work.

## Scope and limitations
This phase provides assignment and priority tracking. Automated escalations, reassignment audit trails, email delivery via Resend, and independent security testing are not yet included. This remains a pilot, not an official City system.
