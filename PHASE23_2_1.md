# CivicOps Phase 23.2.1 — Mobile Admin Table Readability

Fixes the narrow-column wrapping shown on iPhone in the Employee Directory, Pending Invitations and Recent Audit Activity. Under 768px, tables become vertically stacked, labeled records. On desktop, tables are unchanged. No changes to authentication, Supabase, employee roles, database or existing workflows.

Deploy: extract into the existing CivicOps repository, commit and push, then test Administration on iPhone and desktop. On mobile confirm each employee has readable name, department, role and action; each audit event has date, event, department, record and details. Check role buttons still work only for authorized admins.

Source-level change only; production browser QA remains required.
