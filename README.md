[https://www.para-siempre.love/](https://www.para-siempre.love/)

## Media Admin Notes

Any authenticated user can access the admin dashboard with write permissions by
default.

For read-only testing, assign a Firebase Auth custom claim to that user:

- `adminRole: "readOnly"` or
- `adminReadOnly: true`

That claim keeps admin dashboard access but disables write actions and masks
guest name/email in the UI.

Read-only test account:

- Email: `test_admin@para-siempre.love`
- Password: shared out-of-band for test use only

Apply upload CORS separately on the bucket after updating `storage-cors.json`:

```bash
gcloud storage buckets update gs://parasiempre-4fa62.firebasestorage.app --cors-file=storage-cors.json
```

## Local Firebase Functions

To test callable functions before deployment while using the real Firestore
database for the admin RSVP table:

1. Copy `.env.local.example` to `.env.local`.
```bash
cp .env.local.example .env.local
```
2. Start Firebase Functions locally:

```bash
firebase emulators:start --only functions
```

3. In another terminal, start Vite:

```bash
pnpm run dev
```

When `VITE_USE_FUNCTIONS_EMULATOR=true`, the frontend calls the Functions
emulator at `localhost:5001`.

Only set `VITE_USE_FIRESTORE_EMULATOR=true` if you also start Firestore:

```bash
firebase emulators:start --only functions,firestore
```
