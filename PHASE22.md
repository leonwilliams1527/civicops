# Phase 22 — Workflow Automation & Notifications

## Installation
1. Back up the Supabase database. Run `supabase/phase22.sql` in SQL Editor, after phases 13, 20 and 20.1.
2. Deploy the entire Phase 22 folder to the existing repository; retain your Vercel environment variables.
3. The existing `vercel.json` schedules `/api/cron/civicops-notifications` at 13:00 UTC daily (Vercel plan permitting). Set `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` as server-only environment variables.
4. Set `CIVICOPS_AUTOMATION_ENABLED=true` to activate daily request and milestone reminders. Without it, the endpoint deliberately does nothing.
5. For optional email delivery, verify a sending domain with Resend and configure `RESEND_API_KEY`, `CIVICOPS_EMAIL_FROM` and `CIVICOPS_EMAIL_ENABLED=true` on the server. Until then, in-app notifications and the outbox work, but no emails are sent.
6. Redeploy after changing Vercel environment variables. Never expose the service role or Resend key as `NEXT_PUBLIC_*`.

## Behavior
- Milestone owner changes create in-app assignment alerts.
- Daily milestones due in the next three days trigger reminders. Past-due milestones trigger overdue reminders, escalating after three days.
- When assigned, reminders go to the owner. When unassigned, they go to the owning department's admins. Escalations additionally notify the lead department's admins.
- Reminder log prevents duplicate alerts for the same milestone/category/day, even if cron retries.
- Existing request reminders remain active. Email preferences and the existing queue worker are reused.
- Milestone notifications navigate to Management; request notifications retain their request deep links.
- This phase does not introduce an organization-wide view or weaken row-level access policies.

## QA
1. Assign a milestone to a Permitting employee and verify their bell alert.
2. Run a safe reminder test with a fictional milestone due within 3 days; after cron runs, verify exactly one reminder per eligible recipient.
3. Repeat cron the same day and verify no duplicate reminders.
4. Verify opt-out email preference prevents queuing; in-app alerts still arrive.
5. Test overdue/escalation and department scope using non-production records.
6. Test Vercel logs and Resend delivery separately; a successful deployment does not prove cron or email delivery.
7. Check that CRON_SECRET is set, the endpoint rejects unauthorized calls, and the service-role key is never sent to the browser.

Caution: A manual test call to the deadline RPC writes real notifications. Test using approved fictional records, and do not enable email until domain verification and recipients are confirmed.
