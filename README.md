[README.md](https://github.com/user-attachments/files/34979294/README.md)
# CPCS — Class Party Contribution System

Existing project updated in place. Firebase project: **`cpcs-4a2c1`**. Static hosting is supported (including GitHub Pages); no server or paid service is required by this code.

## Preserved features
- Student registration with name, class, EV/BM version and contribution package.
- EV and BM submission recipients are editable in Admin Settings (defaults: Tariqul Sir and Rafiqul Sir).
- Firebase Authentication admin sign-in and Firestore integration.
- Pending/confirmed contribution workflow and confirmed-only public leaderboard.
- Attendance management, public notices, CSV export and responsive white/sky-blue interface.
- Permanent registration records: Firestore rules deny deletion.

## Updates in this package
- Admin can create unlimited packages, rename them, change whole-number prices, and enable/disable them. Only active packages appear in public registration.
- Marking a registration absent creates or updates one deterministic public notice for that registration. Marking present deactivates it. Existing absent records are reconciled when an admin opens the dashboard.
- General notices can be created, edited, published and unpublished. Unpublishing is the archive/hide mechanism; there is no delete control.
- Leaderboard synchronization uses the updated record values, and hidden/pending entries are not shown publicly.
- Public settings are fetched by the exact `publicSettings/main` document, compatible with the restrictive rules.
- Added `firestore.indexes.json` for the two compound public queries.

## Firebase setup / deployment

1. Open Firebase Console and select the existing project `cpcs-4a2c1`.
2. Enable **Firestore Database**.
3. Under **Authentication → Sign-in method**, enable **Email/Password**.
4. Under **Authentication → Users**, create the admin account. Do not put its password in source code or this repository.
5. Open that user's details and copy the Firebase Authentication **UID**.
6. Replace `REPLACE_WITH_ADMIN_AUTH_UID` with that exact UID in **both** `firestore.rules` and `admin.js`. Do not replace it with an email or password.
7. Publish the complete `firestore.rules` contents in **Firestore Database → Rules**.
8. Deploy `firestore.indexes.json` using Firebase CLI:
   ```bash
   firebase use cpcs-4a2c1
   firebase deploy --only firestore:indexes
   ```
   Or create the same two indexes manually in Firestore if you do not use the CLI:
   - `publicLeaderboard`: `visible` ascending, `amount` descending.
   - `publicNotices`: `active` ascending, `createdAt` descending.
   Wait until both indexes show **Enabled**.
9. Open `admin.html` on the deployed site, sign in with the admin account, then open **Settings** and save the teacher recipients and desired website switches. This creates `publicSettings/main`, which is required for public registration.
10. In **Packages**, add the contribution packages. Existing package documents are preserved; only active packages are shown to students.
11. For GitHub Pages, push the project files to the repository root and select **Settings → Pages → Deploy from a branch** with the intended branch and `/(root)`.

## Firestore collections and access model

| Collection | Public access | Admin access |
|---|---|---|
| `registrations` | Create valid registration only; no read/update/delete | Read and update; delete always denied |
| `packages` | Read active packages only | Read/create/update; delete denied |
| `publicSettings/main` | Read | Create/update; delete denied |
| `publicLeaderboard` | Read documents where `visible == true` | Create/update; delete denied |
| `publicNotices` | Read documents where `active == true` | Create/update; delete denied |

All other collections are denied by default. Admin authorization is based on the configured Firebase Auth UID, not merely on being signed in. Public registration rules check the selected active package, exact package name and amount, configured teacher recipient, open registration setting, pending status, unmarked attendance, and server timestamp.

## Important operational notes

- A Firebase web API key in `firebase.js` is a public client identifier; it is not an admin credential. Security is enforced by Firestore Rules and the admin UID.
- The admin UID placeholder **must** be replaced before publishing the rules. Until then, admin writes and reads will be denied.
- Registration is intentionally public, but public users cannot read private registration documents. Consider enabling Firebase App Check and adding a trusted unique roll/student identifier if abuse or duplicate submissions become a concern.
- This is a client-side GitHub Pages application. Never place admin passwords, service-account keys, or other private credentials in its files.
- Contribution receipt is still confirmed manually by an admin. Only confirmed records are published to the leaderboard.
- Registration records, packages, settings, leaderboard entries and notices cannot be permanently deleted through these rules. General notices should be unpublished to archive/hide them.
- Existing records are not migrated or deleted. Existing absent registrations are reconciled into notices when the admin dashboard next loads.

## Post-deployment acceptance checklist

Use a test student/account after publishing the rules and indexes:

1. Add two packages in Admin; rename one, change its price, disable it, then confirm the public form only shows enabled packages and updated prices.
2. Submit a public registration using an enabled package. Confirm it appears in Admin as pending and that the public leaderboard does not show it.
3. Confirm the contribution in Admin. Confirm it appears on the public leaderboard. Set it back to pending and confirm it disappears.
4. Mark the student absent. Confirm exactly one matching absent notice appears publicly. Mark present and confirm the notice is unpublished while the registration remains in Admin.
5. Create a general notice, edit its title/description, unpublish it, and publish it again.
6. Change EV/BM recipients and registration/leaderboard/notice switches. Confirm the public page reflects the saved settings.
7. As a non-admin signed-in account, confirm the admin page rejects access and Firestore denies private collection reads/writes. As a signed-out visitor, confirm direct reads of `registrations` fail and valid registration creation succeeds.
8. Confirm deletion attempts against registrations, packages, settings, leaderboard entries and notices are denied.

Local checks performed for this archive: JavaScript syntax checks (`node --check`) passed for the application modules, and all JavaScript-referenced HTML element IDs were found. A live Firebase Emulator/production test was not possible from this ZIP-only environment because it does not contain the administrator UID, Authentication session, or access to your Firebase Console. Complete the acceptance checklist after deploying your UID-configured rules and indexes.
