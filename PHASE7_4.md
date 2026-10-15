# CivicOps Phase 7.4 — Activity attribution and status audit

## Install
1. Back up the existing CivicOps-Production project as appropriate. Do not run SQL in GYJobs.
2. Supabase > CivicOps-Production > SQL Editor: run `supabase/phase7_4.sql` **once**. It adds user_profiles, actor_department, event_type, status history, and database triggers without deleting existing requests.
3. Deploy the application files to the same Vercel CivicOps project. Keep existing Supabase environment variables.
4. Log in as Water Quality and Permitting and set a full name using the new display-name form.
5. Post a new comment and change a request status. Confirm the activity displays the author name, department, timestamp and status transition in both sessions. Refresh to confirm persistence.

## QA and limitations
- Existing historical comments get a department backfill based on *current* membership. Their original historical department cannot be independently verified.
- Existing comments do not have stored status transitions; only status changes made after the migration are audited.
- `user_profiles` display names are self-managed and are not verified legal identities. Admin identity verification and locked audit logs require further hardening.
- The SQL must be applied before deploying this UI, otherwise profile features will fail.
- The previous app has a 50-event activity retrieval limit; older events may not appear in the UI. Database retains them.
- The migration is intended for the current Phase 7 schema. Test it with pilot data before handling real city records.
- Build and live integration tests must be performed after deployment; archive integrity is not proof of application functionality.
