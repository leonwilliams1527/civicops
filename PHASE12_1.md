# CivicOps Phase 12.1 — Administrator Management

1. Back up the current database and repository.
2. In Supabase SQL Editor run `supabase/phase12_1_admin_roles.sql` **after Phase 12**. Do not rerun older migrations.
3. Copy the contents of this package into the GitHub repository root (including `app/layout.js`); commit and deploy on Vercel.
4. Log in as any existing admin; the **Administration** button should appear beside Notifications.
5. Open Administration, promote a member, verify they can access the page, demote that account, and confirm access is denied after refresh.
6. Confirm that an ordinary member cannot call the RPC directly, that self-demotion is blocked, and that an audit event appears.

This phase manages roles for existing membership accounts; it does not invite/create Auth users. Names are shown when existing profile read policies permit them. No external email delivery is enabled.
