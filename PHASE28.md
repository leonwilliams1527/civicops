# Phase 28 — User Access Management (safe initial release)

Adds **Administration → User Access Management** to the existing CivicOps sidebar.

## Included
- Authenticated, server-authorized employee directory with owner/super-admin/department-admin scopes.
- Existing employee invitation workflow reused (including resend/revoke of pending invitations).
- Company and department filters, search, role badges, owner visibility and mobile layout.
- Server-side verification of owner registry and super-admin membership.
- No SQL migrations and no modifications to existing RLS policies, triggers or memberships.

## Security boundaries
- The directory endpoint uses a server-only Supabase service role, but first verifies the caller's bearer token and permissions. Never expose the service key in client environment variables.
- The interface does not yet allow changing existing users' privileges, suspending accounts, or assigning cross-department pilot access. These require separately reviewed, audited server-side mutations.
- Cody's existing GIS admin membership is not modified.
- Platform Owner protection remains dependent on the database safeguards already installed.

## Deployment
1. Deploy this ZIP to the same CivicOps Vercel project with existing environment variables intact.
2. Sign in as the owner and open `/collaboration/access-management`.
3. Verify owner badge, six-department visibility, invitations, and department-admin scoping with a test account.
4. Do not run any SQL for this phase.
