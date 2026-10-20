# CivicOps Phase 25.1 — Demo preparation (non-destructive)

## Included changes
- Adds a self-contained CivicOps lettermark in the main collaboration header (no external image URL).
- Adds an opt-in presentation filter to the **Projects & Requests list only**. Open `/collaboration/projects?demo=1`. Request titles starting with `Test`, `LAST TEST`, `Fix It`, or `QA-<number>` are hidden from that list. Click **Show all requests** to return to the normal view.
- Preserves all records, uploads, audit history, roles, and existing permissions. No SQL migration or destructive operation.

## Important limitations
- The original broken header image was observed in a prior live review, but the source package does not contain a corresponding header image reference. The new local lettermark improves branding; verify the broken-image placeholder is gone after deployment. Other image references, including user profile photos, are unchanged.
- The presentation filter **does not** hide QA records in dashboard totals, Management, Reports, notifications, audit activity, or direct links. It is not a privacy or security control. Use a curated recording session and avoid personal details.
- This build **does not create GIS, Engineering, or Finance sample records**: doing so requires live authenticated access, appropriate source data, and explicit approval of example records. Do not imply those departments contain data when they do not.
- A source ZIP cannot make ChatGPT Work record video. Work's navigation capability and video export are separate.

## Deployment and QA
1. Commit the full source tree to the existing GitHub repo and deploy on Vercel, preserving current environment variables.
2. Verify main dashboard and navigation on desktop and iPhone; confirm the new CivicOps lettermark displays.
3. Visit `/collaboration/projects` and verify **all** authorized requests remain visible.
4. Visit `/collaboration/projects?demo=1` and verify the named QA requests are absent from the request list but normal requests remain; click Show all requests.
5. Verify dashboard counts, Management, Reports, uploads, invitations, and employee permissions remain unchanged.
6. Use approved demonstration identities and sanitize visible personal information before filming.

No database or production deployment has been performed by this package.
