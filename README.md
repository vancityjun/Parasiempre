[https://www.para-siempre.love/](https://www.para-siempre.love/)

## Media Admin Notes

Media setting changes now require either:

1. A Firebase Auth custom claim: `admin: true`
2. An allowed admin email in the Functions environment via `MEDIA_ADMIN_EMAILS`

If `MEDIA_ADMIN_EMAILS` is not set, the backend falls back to `vancityjun@gmail.com`.

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
