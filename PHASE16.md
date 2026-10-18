# Phase 16 — Notification UI consistency

This is a targeted UI-only update based on the working Phase 15 application.

- Keeps one notification control in the top navigation, with an unread badge only when unread notifications exist.
- Removes the duplicate Notifications control from the employee profile strip.
- Moves the existing notification panel to the top navigation so notifications remain accessible.
- Preserves the My Account button, admin access, request assignments, documents, and reporting.

## Deploy
1. Extract the ZIP. Copy all extracted app files to the root of the existing CivicOps GitHub repository (not into a nested folder).
2. Commit and push to main; wait for Vercel to show Ready.
3. Open Notifications in the top navigation; verify unread badges, notification list, and click-through still work.
4. Verify the profile strip shows My Account without a second notification counter.

No Supabase SQL migration is needed. This package has not been verified in the live Vercel deployment.
