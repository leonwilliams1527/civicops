# CivicOps Phase 24 — Branded transactional email

## Included
- Branded, responsive Supabase Auth HTML templates for **Invite User**, **Reset Password**, **Confirm Signup**, and **Magic Link** in `email-templates/`.
- Safe, HTML-escaped email renderer for application notifications in `lib/civicops-email.js`.
- Updated existing Resend-based notification cron email to include branded HTML and a plain-text fallback.
- Updated existing Resend-based **resend invitation** action to include branded HTML and a plain-text fallback.
- All previous pages, roles, mobile fixes, and database files preserved.

## Important: Auth email templates require one-time manual setup
Supabase Auth sends initial invitations and recovery emails through your configured Resend SMTP. Deploying a Next.js ZIP **does not automatically change Supabase's stored email templates**.
1. Supabase → Authentication → Emails → Templates → **Invite user**. Switch to Source and paste `email-templates/supabase-invite.html`. Save.
2. Supabase → Authentication → Emails → Templates → **Reset Password**. Paste `email-templates/supabase-recovery.html`. Save.
3. Optionally paste the Confirm Signup and Magic Link templates into their matching sections. Only enable authentication flows you intend to use.
4. **Do not replace `{{ .ConfirmationURL }}` with `/login` or a static URL**. Supabase generates a unique secure link for each request.
5. Supabase → Authentication → URL Configuration: Site URL `https://civicops-sigma.vercel.app`; redirect allowlist `https://civicops-sigma.vercel.app/**` until you move the website domain.
6. Supabase → Authentication → SMTP: verified sender `accounts@civicopsplatform.com`, host `smtp.resend.com`, port `465`, username `resend`, and your current private Resend API key. Do not put this key in GitHub.

## Optional application notifications (disabled by default)
The existing notification cron is guarded by `CRON_SECRET`, `CIVICOPS_AUTOMATION_ENABLED=true` and `CIVICOPS_EMAIL_ENABLED=true` and requires server-only `RESEND_API_KEY` and `CIVICOPS_EMAIL_FROM=notifications@civicopsplatform.com`. The Resend API key must have sending access for the verified domain. **Do not enable automated notifications until the queue/RPC functions, recipient preferences, and permissions have been validated in production**. The existing Vercel cron schedule is unchanged.

## Deployment
Deploy the entire ZIP to the existing CivicOps GitHub/Vercel project. No SQL migration is required. After deployment, test one password reset email and one new invitation in a private browser. Verify links reach `/auth/activate`, password setup succeeds, role/department remain correct, and the branded email renders in Gmail and iPhone Mail.

## QA boundaries
Template files are ready to paste, not automatically published to Supabase. This package does not change live Supabase or Resend settings. It has not been deployed or end-to-end tested against live services.
