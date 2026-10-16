# CivicOps Phase 8 — Department Files (Pilot)

## Install
1. Supabase → CivicOps-Production → SQL Editor: run `supabase/phase8.sql`.
2. Deploy all files from this package to the existing GitHub repo (prefer GitHub Desktop). Keep existing Vercel environment variables.
3. Sign in and upload a **non-sensitive test** Excel or CSV file using **My department**.
4. Refresh and verify it persists and downloads. Sign in to the other department and verify it **cannot** see the department-only file.
5. Select a request, choose **Selected request**, upload a test document; verify both participating departments can see/download it.

## Scope and limitations
- Private Supabase Storage, 10 MB/file, Excel/CSV/PDF/Word, request attachments, and department file library.
- No spreadsheet parsing, automatic dashboard ingestion, version history, antivirus scanning, or admin file management yet.
- Do not upload sensitive/official government data. Security review and malware scanning are required before real deployment.
- Storage upload/download now travels through the existing Supabase proxy, which supports storage/v1.
- SQL policies are intended for department isolation; verify cross-department access using separate accounts before real use.
- Pilot uploads use unique object paths; the app does not offer deletion yet.
