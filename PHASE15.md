# CivicOps Phase 15 — Request Ownership and Assignment

## What changed
- Requester shown on request cards and details, using the saved authenticated user profile.
- Database trigger derives the requester ID and requesting department from the authenticated session for new requests.
- New requests go to a **department inbox**, initially **Awaiting assignment**.
- Receiving-department admins can assign, reassign, and unassign employees from their own department.
- Receiving-department members can claim unassigned requests. The requesting department cannot manage another team's assignments.
- New owners get a personal in-app notification and (if enabled) an outbox entry. No external email is sent unless Phase 13 delivery is separately enabled.
- Assignment changes are written to a protected audit table. Unread badges are compact and capped at `9+`.

## Install (in order)
1. **Back up the database** and confirm Phase 9 and Phase 8.3 tables exist. Verify Phase 14.1 is currently working.
2. In Supabase SQL Editor, run **only** `supabase/phase15.sql`. This adds no destructive table operations.
3. Extract this package into the existing GitHub repository, keeping its `app`, `supabase`, and other directories in place. Do not nest the package directory within your repository.
4. Commit and push. Confirm Vercel reports **Ready**. Phase 15 does not require new environment variables.
5. Test with fictional requests; do not enable external email delivery for this test.

## QA checklist
1. Sign in as Water Quality and create a fictional request for Permitting. Confirm **Requested by** displays the Water Quality employee's real profile and owner is **Awaiting assignment**.
2. Sign in as a Permitting **member**: claim an unassigned request. Confirm it appears in **Assigned to me**. Attempt to reassign another employee: there must be no reassignment control.
3. Sign in as a Permitting **admin**: assign a Permitting employee, then reassign to a different Permitting employee. Confirm the new owner gets a notification and the previous owner is no longer shown as owner.
4. Sign in as Water Quality: verify the requester cannot assign Permitting employees.
5. Verify the `civicops_assignment_audit` table has rows and that a normal authenticated client cannot query it.
6. Check Dashboard, Projects & Requests, Documents, Reports, and Administration navigation, including sign-in and profile editing.

## SQL verification
```sql
SELECT to_regprocedure('public.civicops_assign_request(uuid,uuid)') AS assignment_rpc,
       to_regclass('public.civicops_assignment_audit') AS assignment_audit;
SELECT tgname FROM pg_trigger WHERE tgrelid='public.update_requests'::regclass
 AND NOT tgisinternal AND tgname IN ('civicops_set_requester','civicops_notify_assignee');
```

**Important:** Existing historical `created_by` IDs are preserved. If older requests lack a visible profile, the UI says *Employee profile unavailable* rather than inventing a requester name. The Phase 15 SQL and application require live testing in your Supabase and Vercel environments before pilot release.
