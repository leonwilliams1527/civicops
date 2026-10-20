# CivicOps Phase 26 — Modern interface

## Included
Presentation-inspired navy left navigation on the main dashboard, Projects & Requests, and Data & Documents; consistent card, button, input, typography and surface styling. Existing Phase 25.1 business logic and Supabase operations are preserved. Reports, Management, project workspaces and Administration receive a matching visual finish, but their page structure has not been rewritten into a universal sidebar.

## Deployment
1. Back up the current GitHub deployment and Supabase database.
2. Replace application source with the ZIP contents, preserving environment variables.
3. Run `npm install` and `npm run build`, then deploy to a Vercel preview first.
4. Test all six departments, role-based visibility, navigation, request creation and updates, attachments, spreadsheet imports, management, notifications, employee invitations and mobile.
5. Promote to production only after acceptance. No SQL migrations are required.

## Important
This is a CSS-led visual update, not an exact implementation of the simulated demo's every page. No live deployment or Supabase tests were performed by this package generator.
