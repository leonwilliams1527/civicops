# CivicOps Phase 8.1 — Modern Request Workspace

Built on Phase 8. No new SQL migration required if Phase 8 migration and profile grants are installed.

## Changes
- Existing employees see only name, designation, department and role in the header. Use **My Account · Edit profile** for changes.
- New employees without a saved full name or designation complete an initial profile before seeing the workspace.
- Request attachments are uploaded directly inside the selected request. Department Files remains a separate department-only library.
- Downloads use a browser Blob with the original filename.
- Successful notifications dismiss automatically after 5 seconds; errors remain until dismissed.
- Existing Supabase proxy, authentication, membership, requests, and activity history retained.

## Deployment
Copy the extracted project contents into the existing GitHub repository with GitHub Desktop, commit and push. Do not upload the ZIP to the GitHub web uploader. Keep the current Vercel environment variables.

## QA
1. Sign in with an existing completed profile; confirm the form is absent and header shows name and designation.
2. Open My Account · Edit profile, update title, save and refresh.
3. In a new account with membership, complete required full name and designation; confirm the workspace opens.
4. Open a request and attach a non-sensitive test Excel file in Request attachments. Verify both participating departments can download it.
5. Confirm a department-only file is hidden and inaccessible to the other department.
6. Confirm the downloaded file has the correct filename and opens correctly.
7. Confirm success notification dismisses after 5 seconds, while errors remain visible.
8. Verify status changes, comments and mobile layout.

Note: The current pilot is not an official city system. Authorization and direct-storage-access testing remain required before sensitive data.
