# Phase 21 — Management Reporting & Department Performance

## Deploy
1. Deploy the complete Phase 21 directory to the existing CivicOps repository and Vercel deployment.
2. No SQL migration is required; Phase 20 and Phase 20.1 must already be applied.
3. Open **Management** in the CivicOps navigation, or follow the link from **Reports**.

## Features
- Accessible project summary, milestones, and requests.
- Department workload table and milestone accountability, with filters for department, project search, and milestone state.
- CSV exports for currently filtered/accessible rows.
- Direct links to project workspaces.
- Metrics computed from existing Supabase rows under the current authenticated user's RLS policies.

## Security and interpretation
- This is a **permission-scoped** management report, not a global executive rollup. It deliberately does not bypass RLS or expose restricted spreadsheet imports.
- Department workload may be incomplete for users who cannot access every project; counts are of **visible records** only.
- Imported project progress is separate from milestone status and is not recalculated.
- Request matching is based on project IDs as in previous phases; verify uniqueness of imported project IDs for organization-wide reports.
- Reports load up to 5,000 accessible rows per entity; larger deployments require paginated/server-side aggregates.
- Exports happen locally in the browser and contain only filtered rows already visible to the user.

## QA
1. Water Quality: verify BMAP-101 and its Permitting Review milestone appear.
2. Permitting: verify shared BMAP-101 appears; unrelated Water Quality projects do not.
3. Filter by Permitting and verify the workload and milestone table.
4. Change a milestone status, refresh Management, and verify metrics update.
5. Export CSV and verify column names, filtering, and Excel opening.
6. Check narrow/mobile screens and the unauthorized-user state.

Live RLS, build, and browser integration must be verified in your environment.
