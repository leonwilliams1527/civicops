# Phase 27.2 — BMAP Location Entry

Based on Phase 27.1; retains the shared sidebar, Supabase integration and RLS.

## New methods
- Search Florida addresses/places using OpenStreetMap Nominatim public geocoding (availability and usage policy apply).
- Click on map to choose coordinates, then confirm and save.
- Device GPS with permission and approximate accuracy indication.
- Direct latitude/longitude entry.
- Preview CSV/XLSX locations and choose an individual row for confirmation. No bulk writes.

## Important
All five methods end at the existing authorized Save verified location action. No unverified location is automatically saved. Coordinate validation restricts the range to Florida. The location search requires internet access; external geocoding services may impose rate limits.

## Deploy
1. Back up the current application; deploy this ZIP to a Vercel preview.
2. Keep the existing Supabase environment variables and Phase 27 SQL/RLS policies. No new migration is required.
3. Test the five methods on desktop and mobile using a non-sensitive sample project.
4. Check Dashboard, Reporting, Management, requests, and access control regression before production.

## Verification limits
The package is assembled and syntax inspected, but a production Next.js build and browser test are not yet confirmed.
