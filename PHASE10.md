# CivicOps Phase 10 — Deadline Reminders & Escalations

## Features
- Department dashboard: **Needs attention** count and filter.
- Flags overdue requests, urgent requests, and high-priority requests without owners.
- Secure database function for due-soon, overdue, and 3+-day overdue escalation notifications.
- Idempotent daily reminder log to prevent duplicates on retry.
- Notifications feed into existing in-app alerts and the **pending** email outbox. **Resend is not connected.**

## Installation
1. Ensure the corrected Phase 8.3 notification migration and Phase 9 migration ran successfully.
2. Run the full `supabase/phase10.sql` in Supabase SQL Editor.
3. Use GitHub Desktop to replace the existing project files with this package; commit and push to main.
4. After verifying recipient behavior, run `SELECT * FROM public.civicops_process_deadlines(CURRENT_DATE);` once in SQL Editor. Running twice on the same day must create no duplicates.

## Important: scheduling is not yet enabled
The reminder function must be invoked by an administrator or a trusted scheduled job. To activate daily reminders later, configure Supabase Cron/pg_cron to call `public.civicops_process_deadlines(CURRENT_DATE)` at an agreed timezone/time. Do not expose the function to browser clients.

## QA
- Confirm a due-soon request is listed in the queue and a notification is created after manual invocation.
- Confirm overdue and 3+-day overdue notifications route to the appropriate departments.
- Run the function again and verify it does not duplicate the day's reminders.
- Confirm completed requests generate no reminders.
- Confirm no emails are actually sent before Resend is configured.
- Confirm existing assignments, profile photos, documents, and permissions still work.

## Limits
No email delivery, scheduled invocation, automatic manager-only escalation, or independent security audit is claimed. The current escalation reaches members of both participating departments. Do not use sensitive operational data until security review is complete.
