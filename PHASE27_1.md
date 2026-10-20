# Phase 27.1 — Layout and BMAP runtime fix
- Corrects `TypeError: o is not a constructor`: `URL` constant shadowed the browser's `URL` constructor in BMAP's proxiedFetch.
- Removes duplicate 256px left margin inherited from Phase 26 dashboard styling when Phase 26.1 shared sidebar is present.
- Aligns BMAP content with the shared application shell.
- Clarifies missing membership errors. This release does **not** bypass authorization or change RLS policies.
- No SQL migration needed if Phase 27 SQL was already executed.
## Test
1. Deploy to Vercel preview, sign in, open `/collaboration/bmap`; confirm no constructor error.
2. Confirm the existing Water Quality membership is recognized and data loads.
3. If membership still fails, compare the current session and memberships table with the Dashboard session; do not grant access blindly.
4. Visit Dashboard, Reports, Management, Administration and BMAP on desktop/mobile; ensure no extra left gap and no overlap.
5. Verify Supabase BMAP tables and RLS after Phase 27 SQL is applied.
Build and live tests have not been run.
