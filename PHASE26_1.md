# CivicOps Phase 26.1 — Persistent Sidebar Fix

## Root cause
The Phase 26 navigation was rendered inside the dashboard page component rather than in a shared Next.js route layout. Reporting and other subpages were therefore able to render without the sidebar.

## Change
A shared `app/collaboration/layout.js` wraps all `/collaboration/*` routes with a consistent sidebar. `app/collaboration/shell.css` provides desktop and mobile styles. The original per-page data access, spreadsheet imports, reporting, request and document workflows were not edited.

## Verification after preview deployment
1. Visit Dashboard, Projects & Requests, Data & Documents, Reports, Management, Administration; sidebar remains visible and active item updates.
2. Open a project workspace and return; navigation remains visible.
3. On mobile, open and close the navigation drawer; verify forms and tables remain usable.
4. Sign in as an ordinary employee and confirm server/database authorization remains enforced (a navigation link is not permission to access a route).
5. Check spreadsheet imports, report totals, CSV actions, request updates and files against the previous release.

Deploy to a Vercel preview first. No database migrations or deletions are included.
