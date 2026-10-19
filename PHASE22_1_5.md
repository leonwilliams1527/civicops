# CivicOps Phase 22.1.5 — Public sign-in and onboarding repair

This package is based on Phase 22.1.4 and retains all existing project, department, notification and administration code.

## Fixes
- `/` opens a **public** `/login` page. This works before an employee has signed in.
- `/login` has visible **First-time account setup** and **Forgot password?** links.
- `/forgot-password` emails a Supabase recovery link to `/auth/activate?flow=recovery`.
- `/auth/activate` verifies Supabase invitation/recovery links and sets a 12+ character password.
- The collaboration dashboard no longer offers public self-registration; employee accounts are invitation-only.
- Pending invitations list excludes accepted/revoked records. Invitation status is recorded after successful password creation.
- The invitation API requires a public HTTPS site URL for new invitations.
- No existing membership, role or project data is changed.

## Deploy
1. Back up the repository. Deploy the **entire** ZIP to the same GitHub/Vercel project.
2. Supabase > Authentication > URL Configuration: set **Site URL** to `https://civicops-sigma.vercel.app` and allow `https://civicops-sigma.vercel.app/**`.
3. Vercel Production: `NEXT_PUBLIC_SITE_URL=https://civicops-sigma.vercel.app`; retain `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy to **Production**, then open `https://civicops-sigma.vercel.app/login` in an incognito/private window.
5. Test `https://civicops-sigma.vercel.app/forgot-password` **without signing in**. Use the previously accepted employee's email; do not create another account.
6. Check the email link lands at `/auth/activate`, create a password, and sign in at `/login`.
7. Confirm department and role in CivicOps. Check Pending Invitations excludes accepted/revoked rows.

## QA limitations
- A successful ZIP check is not a Next.js build. Vercel compilation and live Supabase email delivery must be tested.
- Supabase's default email provider may rate-limit messages. If recovery mail doesn't arrive, check Supabase Auth logs and SMTP settings.
- Previously accepted invitations cannot be retroactively made pending; password recovery works for those accounts.
- For a fresh invitation, status changes to accepted after password creation. The audit update is best effort; if it fails, the employee can still sign in, and admins can reconcile the invitation.
- Do not publish any service-role key or invite tokens.
