# CivicOps Phase 23 — Security and QA baseline

## Scope
This release preserves Phase 22.1.5 application code and adds a repeatable **static QA suite**. It is **not** a certification that the deployed database, policies, or runtime are secure.

## Run
`node qa/static-audit.mjs` from the project root.

## Manual acceptance tests required before launch
1. Anonymous visitor cannot read requests, projects, documents, employee profiles or management reports through direct URLs or Supabase REST.
2. Employee in Department A cannot query or mutate Department B records by changing IDs in network requests.
3. Department admin can invite only their department's members; Super Admin can invite across departments and assign admin roles.
4. Revoked invitation cannot be used to gain access; pending invitation is excluded from accepted lists.
5. Request assignment, claim, milestones and document sharing follow department policies at the database level (RLS), not just hidden buttons.
6. Export/report queries are scoped to authorized departments and return correct aggregates.
7. Cron without CRON_SECRET returns 401; automation/email delivery disabled unless explicitly enabled.
8. Test iOS Safari and desktop browser navigation and password recovery with an incognito session.
9. Test actual Resend invitation and recovery email only after domain verification and SMTP configuration (deferred).

## Known follow-up work
- Supabase Authentication currently sends default invitation and recovery emails; branded Resend/SMTP configuration is **deferred** as requested.
- Existing invitation and notification API code already contains some Resend support; consolidate branded email templates when that phase resumes.
- Security authorization cannot be established by source scanning alone; perform live RLS and API tests with at least three test users.
- Next.js build requires dependencies installed (`npm ci` or `npm install`) and real environment configuration.
