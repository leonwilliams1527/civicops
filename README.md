CivicOps Phase 11 Excel Import Fix

Replace app/collaboration/reports/page.js and package.json with these files.
Ensure read-excel-file is installed by running npm install, then commit package-lock.json if it changes.
Push to main and allow Vercel to redeploy. If Vercel has a stale dependency cache, redeploy without build cache.
No SQL migration required.
