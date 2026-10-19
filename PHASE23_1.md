# CivicOps Phase 23.1 — Department directory and password activation redirect fix

## Included
- All six departments shown to Super Admins, including those with zero visible staff.
- Department-specific visible staff/admin counts and open-request counts, plus employee filter.
- Readable audit events and safe fallback when a profile has no name.
- Recovery/invitation links landing at `/login#access_token=...` immediately forward to `/auth/activate` **before sign-in**.
- Activation explicitly establishes a Supabase session from the recovery link, removes the tokens from browser history, and offers password creation.

## Deployment
1. Back up your current repository, then replace its application files with this ZIP and push to the production branch.
2. Confirm Vercel production deploy shows Ready.
3. In Supabase Authentication > URL Configuration, set Site URL to `https://civicops-sigma.vercel.app` and allow `https://civicops-sigma.vercel.app/**`.
4. Under Authentication > Email Templates > Reset Password, ensure the email uses `{{ .ConfirmationURL }}` rather than a hardcoded `/login` link.
5. Revoke sessions exposed by the previously shared URL; do not delete the employee or department membership.
6. Use a **fresh** link from `/forgot-password`. Email rate limiting may still block sending until Resend/custom SMTP is configured.
7. The email link should open the activation form. Enter a password of at least 12 characters, save, then sign in at `/login`.
8. Verify Project Management employee access and that the Super Admin sees all six departments on `/collaboration/admin`.

## Limits
- Existing deployment, Supabase email delivery, and role-scoped live data access cannot be verified offline.
- Employee counts reflect visible memberships, not guaranteed organization-wide totals.
- The app has no verified project-level department census; no invented project counts are shown.
- This patch does not implement Resend.
