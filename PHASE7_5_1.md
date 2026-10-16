# CivicOps Phase 7.5.1 — Profile persistence and status layout correction

## Changes
- Prevents background refreshes from overwriting a profile form while an employee edits it.
- Tracks profile initialization per authenticated user rather than relying on stale React closure state.
- Saves full name and designation together, then reads them back from Supabase before showing a success message.
- Keeps typed values if the save fails and reports the returned error.
- Allows status badges to wrap as whole labels and remain visible in request cards and activity.

## Deployment
Deploy this package over the existing Phase 7.5 app using the same Vercel project and existing environment variables. **No additional SQL migration is needed** if the Phase 7.5 SQL migration and designation column are already present.

## QA
1. Log in as Water Quality. Enter full name and designation, then save.
2. Verify the page says `Profile saved and verified successfully.`
3. Refresh and confirm both fields persist. Wait 20 seconds and confirm they are not cleared by background refresh.
4. Sign in as Permitting in a second browser and repeat. Post a test comment.
5. Verify author name, designation, and department on the comment in both browsers.
6. Verify complete `In Progress` status badges in request list and activity history on desktop and mobile.

Historical entries can display an author's current verified profile if the actor ID is stored. They cannot independently prove the historical designation at the time of posting.
