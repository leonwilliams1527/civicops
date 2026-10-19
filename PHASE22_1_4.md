# Phase 22.1.4 — Employee Account Activation

## Deploy
1. Deploy this complete ZIP to the existing CivicOps repository (same project as Phase 22.1.1). It preserves all prior application files.
2. In Supabase > Authentication > URL Configuration set Site URL to `https://civicops-sigma.vercel.app` (not localhost), and allow redirect `https://civicops-sigma.vercel.app/**`. Save.
3. In Vercel Production set `NEXT_PUBLIC_SITE_URL=https://civicops-sigma.vercel.app` and redeploy. The service role key must stay server-only.
4. **No SQL migration required** for this phase.

## How it works
- New invites redirect to `/auth/activate?flow=invite`, where employees choose and confirm a password (12+ characters).
- Sign-in now offers **Forgot password? / First-time password setup**, which sends a Supabase recovery email linking to `/auth/activate?flow=recovery`.
- The activation page handles invite/recovery hash tokens, PKCE code redirects, and token_hash links.
- A password is saved with Supabase `auth.updateUser`, not in an application database.
- The Pending Invitations list displays pending invitations only. Accepted and revoked rows remain in Supabase for audit history.
- Existing department memberships and admin privileges are not changed.

## Existing accepted invitations
Use **Forgot password? / First-time password setup** on CivicOps sign-in with the existing invited email. Do not create another account. Check the recovery email and create a password using the new page.

## QA
1. Test the already accepted employee via Forgot Password, check link goes to production `/auth/activate`, set password, and sign in.
2. Verify Project Management membership and Employee role.
3. Send a new test invitation and verify `/auth/activate` opens before password is set.
4. Verify password mismatch, too-short password, and expired links show useful errors.
5. Verify accepted and revoked rows are hidden from Pending Invitations but remain in Supabase.
6. Test mobile email opening, incognito session, and a second browser.
7. Confirm production Site URL no longer points to localhost.

**Note:** Supabase email templates are unchanged. Supabase's default email sending has rate limits; custom SMTP may be needed for production volume. The acceptance flow still depends on a valid Supabase Auth link and correct redirect settings.
