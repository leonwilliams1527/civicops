# CivicOps Phase 22.1 — Employee Invitations and Department Administration

## Deployment
1. Back up your Supabase database. In Supabase Auth → Users, verify that the owner account has UUID `65838f61-5857-4d04-9ee9-3a0d68bc0ab1`. The migration seeds **only that existing user** as Super Admin. If that UUID is not your intended owner, stop and adjust the migration before running it.
2. Run **only** `supabase/phase22_1.sql` in Supabase SQL Editor. This creates the invitation ledger and restricts the existing role-change RPC to Super Admin.
3. Deploy the complete application ZIP to your existing repository. Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel as a **server-only** environment variable. Retain the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. In Supabase Auth → Email Templates, configure the **Invite user** template and a suitable redirect URL to your deployed CivicOps site. Set `NEXT_PUBLIC_SITE_URL` to the actual deployed site URL in Vercel (e.g., `https://civicops-sigma.vercel.app`). Configure a working SMTP provider in Supabase Auth to ensure invitations can be delivered reliably; the default Supabase sender is rate-limited.
5. Optional resend: configure `RESEND_API_KEY` and `CIVICOPS_EMAIL_FROM` as server-only Vercel variables and verify the sender domain with Resend. The initial invite uses Supabase Auth; the **Resend** action uses Resend email delivery.
6. Redeploy Vercel after environment changes.

## Behavior
- The Super Admin can invite employees to any of the six departments and assign Employee or Department Admin access.
- Department Admins can invite **Employees only within their own department**. They cannot grant admin roles or alter existing roles.
- The server verifies the caller's Supabase JWT and membership, and applies all role/department rules before using the service-role key.
- Supabase Auth sends a one-time invitation link. Membership and profile are created only after the invite request succeeds; incomplete provisioning is rolled back by deleting the newly invited identity.
- Pending invitations can be resent (when Resend is configured) or revoked. Revocation deletes the unaccepted invited identity and associated membership.
- Accepted status is refreshed when an administrator opens the invitations list. Once accepted, use existing employee management; the invitation can no longer be revoked.
- Admin role changes are audited and restricted to the Super Admin by the database RPC.

## QA checklist
1. As Super Admin, invite a fictional Engineering employee and verify invitation delivery and correct Engineering membership after acceptance.
2. Invite a fictional Permitting Department Admin; verify they can manage their department but cannot grant admin roles.
3. As Permitting admin, try to invite a Water Quality employee or grant admin access; both must be rejected by the server.
4. Confirm an ordinary employee cannot call the invitation endpoint.
5. Confirm duplicate email invitations are blocked; revoke an unaccepted invite and confirm the link no longer grants access.
6. Confirm resend requires Resend configuration and sends only to the original invited address.
7. Confirm existing employee role changes are audited and cannot demote the Super Admin.
8. Review Supabase Auth email deliverability, invitation acceptance, and Vercel logs before using real employee addresses.

## Security scope
This phase scopes **employee invitations and administrator role changes**. Existing older admin-only data policies elsewhere in CivicOps must still be reviewed in Phase 23. This package has not been live-tested against your Supabase project.
