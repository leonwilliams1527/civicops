# CivicOps Phase 27 — BMAP & GIS

## Deploy
1. Keep the working Phase 26.1 deployment available for rollback.
2. In Supabase SQL Editor, run `supabase/phase27_bmap_gis.sql`. This adds two tables and RLS policies without modifying existing project records.
3. Deploy the complete Phase 27 application through your usual GitHub/Vercel process, ideally to a Preview deployment first.
4. Open `/collaboration/bmap` as an authenticated member. On mobile, open the navigation menu and select **BMAP & GIS**.

## Features
- Florida OpenStreetMap tile map with pan and zoom; initial view Southwest Florida.
- Mapped projects linked to their existing project workspaces; map only shows coordinates that were explicitly saved.
- Separate monitoring station layer, location search, project status filtering, and summary cards.
- List of projects missing coordinates; no invented pins.
- GIS members and department admins can enter verified project coordinates or add a monitoring station. Existing records and reporting remain intact.
- Supabase RLS limits access to mapped projects and stations.

## QA checklist
- Sidebar remains present when opening BMAP & GIS, Reporting, and a project workspace.
- Confirm existing imported projects appear under **Awaiting coordinates** before locations are added.
- As an authorized GIS user or department admin, enter a *verified* Florida latitude and longitude; confirm the pin appears and opens the correct project.
- Confirm a normal employee cannot edit locations; confirm project and station access follows department visibility.
- Test pan, zoom, mobile menu, map attribution, filters, and empty states.
- Check the browser console for failed map tiles (internet access required).

## Boundaries
- No sample project coordinates have been fabricated or backfilled.
- Monitoring stations store location metadata and notes, **not** sampling measurements or water-quality compliance results.
- Geographic overlays, BMAP polygon boundaries, lab measurement ingestion, and automated geocoding are not included in this phase.
- Do not upload confidential operational data without the organization's security and data governance review.
