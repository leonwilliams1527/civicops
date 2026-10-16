# CivicOps Phase 8.2 — Department Dashboard + Profile Photos

## Installation
1. Back up the current working repository or make a Git commit before replacing files.
2. Run `supabase/phase8_2.sql` in the existing CivicOps-Production Supabase SQL Editor. Do not reset the project.
3. Copy the extracted application files into the same GitHub repository using GitHub Desktop, commit, and push. Retain existing Vercel environment variables.
4. Confirm deployment succeeded before testing.

## Included
- Department overview: assigned open work, awaiting other departments, overdue items, completed requests. These metrics reflect **requests visible to the signed-in department**, not all requests in the organization.
- Photo upload through My Account → Edit Profile (JPG, PNG, WebP; 3 MB maximum), replace and remove. Photos appear in header and activity avatars; initials remain the fallback.
- Status change badges aligned with the surrounding text.
- Previous Phase 8.1 request attachments, department files, authentication, and activity tracking retained.

## QA
1. Log in as Water Quality, open My Account, upload a non-sensitive profile photo, save, refresh, and verify it remains visible.
2. Log in as Permitting and confirm the Water Quality employee's avatar appears next to their comments. Test photo removal and fallback initials.
3. Verify department metrics against visible requests and test completed/overdue states.
4. Verify status history alignment on desktop and mobile.
5. Retest request attachments and departmental file isolation. Do not upload sensitive operational files before a security review.

## Limitations
- Photo cropping is not included; the UI displays the image as a circular crop via CSS. Use a square image for best results.
- A live deployment test and end-to-end Supabase security audit are still required.
