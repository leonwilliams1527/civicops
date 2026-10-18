# Phase 16.1 — Notification request deep links

Fix: notification clicks now open `/collaboration/projects?request=<uuid>` instead of trying to scroll to a request on the Dashboard page. The Projects & Requests view selects the requested record after Supabase loads it. Existing notification read-state update remains in place.

## Deploy
1. Extract ZIP. Copy application files into repository root, preserving paths.
2. Commit/push and wait for Vercel Ready. No SQL changes.
3. Sign in as Permitting and click a request notification from Dashboard; verify URL and correct request detail.
4. Test clicking a notification while already on Projects & Requests. Test another department's inaccessible request: it must not disclose details.

## Caveat
The app still requires authenticated membership and Supabase RLS to enforce access. A notification pointing to a deleted or inaccessible request will fall back to the normal request list; a dedicated 'request unavailable' state is a future improvement. Live build not executed here.
