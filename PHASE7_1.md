# CivicOps Phase 7.1 — Targeted QA correction

## Included
- Original Phase 7 dashboard and specialist modules preserved.
- Grouped, collapsible navigation with separate legacy demo tools.
- Same-origin Next.js server relay for Supabase Auth and REST HTTP traffic.
- Read-only `/api/supabase-health` server connectivity check.
- 10-second polling for cross-browser request refresh (not WebSocket realtime).
- Clear distinction between live collaboration and local demo modules.

## Deployment
Upload all files to the existing Vercel project. Keep `NEXT_PUBLIC_SUPABASE_URL` set to the BASE URL (`https://<ref>.supabase.co`) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to the publishable key. Redeploy. Visit `/api/supabase-health` first. If the result is `ok:false`, Vercel cannot reach Supabase; the proxy cannot solve upstream DNS and login remains blocked. If `ok:true`, test login on `/collaboration`.

## Limitations / security
This is a PILOT, not a production security-certified application. Auth sessions remain managed by supabase-js browser storage, not HTTP-only server cookies. Server relay forwards user JWT and public key, never uses service-role credentials. Supabase RLS still governs requests. Server relay uses allowlisted Supabase HTTP routes only. Live updates use polling; browser-side realtime WebSockets are not proxied. The main Command Center remains demo-only, with hardcoded sample identity and data; its role controls are NOT Supabase permissions. SQL policies require independent security review, and no sensitive government data should be loaded. The existing `request_activity` policy permits activity insertion for any visible request; confirm that meets your access model.
