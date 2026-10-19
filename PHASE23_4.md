# CivicOps Phase 23.4 — Compact Mobile Administration

This is a full source package based on Phase 23.3. It corrects the overly tall mobile employee and audit cards without changing desktop tables, Supabase authentication, memberships, invitations, or Resend SMTP.

## Changes
- Employee cards: employee name and designation on one heading row, department and role side by side, compact role action.
- Audit cards: date, event and department with a compact description. Redundant record type hidden on phones; available on desktop.
- Invitations: compact two-column card layout when invitations exist.
- Mobile department selector fits available width.
- Corrected outdated pilot checklist text that said Resend was disabled.

## Deploy
1. Back up the current GitHub repository.
2. Extract this package into the same repository and replace files.
3. Commit and push to main, then wait for Vercel production to show Ready.
4. Refresh on iPhone; review Administration > Employee directory and Recent audit activity.
5. Confirm desktop tables and employee onboarding still work.

## QA
Source-level check and ZIP integrity were performed. Live Vercel build and actual iPhone visual QA are still required. The changes intentionally affect only mobile administration layout.
