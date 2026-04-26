[https://www.para-siempre.love/](https://www.para-siempre.love/)

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
