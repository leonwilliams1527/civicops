# CivicOps Phase 8.3 — Notification Center and UI improvements

## Install

1. In the **existing CivicOps-Production Supabase project**, run `supabase/phase8_3.sql` once in SQL Editor. Do not reset the project.
2. Replace your local CivicOps repository files with this package using GitHub Desktop. Commit and push to main, allowing Vercel to redeploy.
3. Do not set a Resend API key yet. The email outbox is **queued only**; no email is sent.

## Features

- New assignment, cross-department update, status change, and request attachment notifications, stored in `notifications` and shown in a bell menu.
- Unread indicators and open-request navigation. Alerts are polled with existing refreshes (~10 seconds).
- Email notification outbox with per-user email preference; delivery is **not enabled** until a future secure server-side Resend integration.
- Optional desktop notifications while the site is open, where supported and permission is granted. Background web push is not included.
- Status badge alignment across cards and activity.
- Profile photo zoom and horizontal/vertical positioning before saving a 384×384 optimized image.
- Back to Dashboard button in profile editing.

## QA checklist

1. Sign in as Water Quality and Permitting in separate browser sessions.
2. Create a test request to Permitting; confirm Permitting sees the bell alert and can open it.
3. Post a comment from Permitting; confirm Water Quality receives an alert.
4. Change status and attach a small test file; verify the corresponding alerts.
5. Mark an alert read, refresh, and confirm unread count stays correct.
6. Test email/desktop preferences; do **not** expect an email yet.
7. Upload and crop a test image; refresh and verify the circular avatar.
8. Check the status event badges on desktop and mobile.
9. Verify existing request access and document permissions still hold. **Do not upload sensitive records until a security review is completed.**

## Before connecting Resend

A separate secure server-side delivery worker, verified sender domain, API key stored only in server secrets, retry/backoff logic, bounce handling, and delivery logs are required. Never expose the Resend API key through `NEXT_PUBLIC_` variables. The email outbox is not accessible to authenticated client users.

## Validation

This package is provided for deployment and QA; it has not been tested against your live Supabase database or Vercel environment.
