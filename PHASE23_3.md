# CivicOps Phase 23.3 — Mobile table readability

This complete source package carries forward Phase 23.2.1 mobile table fixes and all prior functionality.

## Changes
- Employee Directory and Pending Invitations render as labeled, stacked records on phone screens.
- Recent Audit Activity renders as labeled records with readable descriptions.
- Long words are not forcibly broken into individual letters in narrow table columns.
- Desktop retains the normal table layout.
- No changes to Supabase, Resend, permissions, or authentication. No SQL migration.

## Deployment
1. Back up your existing GitHub repository.
2. Extract the ZIP and copy its contents into the repository root.
3. Commit and push to main. Wait for Vercel Production to show Ready.
4. Refresh CivicOps on a phone; open Admin > Employee Directory and Recent Audit Activity.
5. Check that each record has readable labels and action buttons, and that desktop tables still render normally.

## Validation limits
Static source verification and ZIP integrity are not live browser or Vercel build tests. Test the deployed mobile page before considering the issue resolved.
