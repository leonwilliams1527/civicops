# CivicOps Phase 6 — Department Coordination & Data Integration

## Deploy
Upload `app/`, `package.json`, `PHASE5.md`, and `PHASE6.md` to the existing GitHub repository root. Commit to `main` to trigger Vercel. This build extends the fixed Phase 5 version and preserves existing modules.

## New module
Open **Department Coordination** in the sidebar. Tabs: Overview, Shared Projects, Update Requests, CSV Import, Activity History.

- Department switcher is a **role simulation**, not login or permission enforcement.
- Requests and their statuses persist only in the current browser via localStorage. They do not notify other users or send emails.
- CSV files are parsed in the browser. Accepts UTF-8 CSV up to 2 MB / 500 data rows; supports quoted fields and commas. Column mapping and preview precede import. Duplicate IDs are blocked (no overwrite). XLSX is not supported directly; export CSV from Excel.
- CSV exports work in the browser.
- Phase 5 evidence intake stores only file metadata, not the document contents.
- All original regulatory values remain labeled demonstration data.

## Pilot acceptance tests
1. Visit Department Coordination → Update Requests. Create a request, mark In Progress and Completed, refresh and confirm state persists.
2. Download the CSV template; import it and confirm DEMO-001 appears under Shared Projects. Try importing it again; duplicate should be blocked.
3. Export shared projects and activity log as CSV.
4. Switch to Management: request creation and CSV import should be disabled (UI demonstration only).
5. Verify Watersheds maps, Monitoring Map, Capital Planning, Phase 5 Pilot, and Reports remain accessible.

## Production prerequisites
Shared Postgres database, authenticated accounts, department membership and row-level access policies, server-side input validation, actual file storage, notification queue/email, immutable audit events, City-approved security controls and data retention. Browser storage is not suitable for live municipal records.
