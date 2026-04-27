# Firebase Functions

This directory contains the Firebase backend for Para Siempre.

## What lives here

- RSVP callable functions
- Follow-up email functions
- Media admin setting functions
- Signed upload URL generation
- Gallery listing and delete functions
- Responsive image variant generation for uploaded photos

The entry point is [index.js](/Users/junlee/workspace/love-lee/functions/index.js).

## Runtime

- Node.js `22`
- Firebase Functions v2
- Firebase Admin SDK
- `sharp` for responsive image variants

## Main functions

### RSVP and email

- `addRSVP`
- `sendConfirmationEmail`
- `sendReminderEmail`
- `sendAfterEmail`
- `sendConfirmationEmailOnCreate`
- `toggleShowUp`

### Media settings and uploads

- `getMediaUploadMode`
- `getMediaSettings`
- `setMediaUploadMode`
- `setNativeSaveMode`
- `createMediaUploadUrls`
- `listMediaPaginated`
- `deleteMediaItem`

### Image processing

- `generateMediaImageVariants`
  Triggered on Storage object finalize in `us-west1`
- `backfillMediaImageVariants`
  Admin-only callable used to populate responsive variants and width metadata for existing photos

## Gallery image pipeline

Original uploads are stored under:

```text
photos/
```

Generated responsive variants are stored under:

```text
photos_resized/
```

For supported images, the backend generates WebP variants for configured widths and stores the generated widths in the original file metadata under:

```text
responsiveWidths
```

`listMediaPaginated` reads that metadata and returns:

- `url`
- `thumbnailUrl`
- `srcSet`

This avoids per-request signed read URLs and per-variant existence checks in the hot gallery path.

## Admin access

Any authenticated user is treated as a write-enabled admin by default.

If a user has the Firebase Auth custom claim `adminRole: "readOnly"` or
`adminReadOnly: true`, admin write callables reject that user while the
frontend keeps dashboard access in read-only mode.

## Local development

From the repo root:

```bash
firebase emulators:start --only functions
```

Or from this directory:

```bash
pnpm exec firebase emulators:start --only functions
```

Useful scripts:

```bash
npm run lint
npm run build
npm run deploy
```

## Deploy

Deploy Functions from the repo root:

```bash
firebase deploy --only functions
```

## Storage configuration

Responsive gallery images depend on:

1. Storage CORS being applied from the repo root `storage-cors.json`
2. Storage rules allowing reads from both `photos/**` and `photos_resized/**`

Apply CORS separately:

```bash
gcloud storage buckets update gs://parasiempre-4fa62.firebasestorage.app --cors-file=/Users/junlee/workspace/love-lee/storage-cors.json
```

Deploy Storage rules separately:

```bash
firebase deploy --only storage
```

## One-time backfill

If older photos were uploaded before responsive variants existed, run:

```text
backfillMediaImageVariants
```

That callable is intended as a migration tool, not a routine admin action.
