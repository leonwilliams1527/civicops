# CivicOps Phase 11 — Spreadsheet Intelligence & Reporting

## Scope
- Department-only reporting page: `/collaboration/reports`.
- Read Excel `.xlsx` and CSV files locally in the browser (no spreadsheet is automatically sent to an external parser).
- Map source columns, preview and validate up to 200 rows, then explicitly approve import.
- Import into separate `spreadsheet_imports` and `spreadsheet_projects` tables. Existing requests, attachments, and tasks are unchanged.
- Department-scoped project summary and import history.

## Install
1. Run `supabase/phase11.sql` in your existing Supabase SQL Editor, after earlier migrations.
2. Extract this ZIP into your cloned CivicOps repository; commit and push using GitHub Desktop.
3. Ensure the deployment installs the new `read-excel-file` dependency (`package.json` updated).
4. Sign in as Water Quality and open `Spreadsheet intelligence` from the collaboration workspace.
5. Import the previously supplied fictional sample BMAP tracker. Verify the mapping, preview, validation, and department-only report.
6. Sign in as Permitting and verify Water Quality's imported records are not visible. Test a malformed CSV and duplicate project IDs.

## Important limitations
- This phase creates a **separate reporting dataset**. It does not merge rows with operational request records or automatically parse existing uploaded files.
- Reimporting a spreadsheet creates another snapshot, not an overwrite or automatic deduplication across imports.
- This pilot is limited to 200 project rows / 5 MB per import; `.xls` and macros are not supported.
- Estimated cost uses USD as an illustrative label; confirm currency before operational use.
- No production build or live Supabase security QA has been performed in this environment.
- Resend remains disconnected.
