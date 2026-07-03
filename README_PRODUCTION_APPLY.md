# CIBI Production Apply Guide

This zip updates the uploaded CIBI source with security hardening, YouTube-link course videos, Bunny.net document storage support, Go Live, Daily.co, Resend, Sentry, Render and Vercel production work.

## Do not push until env values are ready

Set these required values on Render backend:

```env
NODE_ENV=production
CLIENT_URL=https://crobic.org
PUBLIC_API_URL=https://api.crobic.org
DATABASE_URL=<Render PostgreSQL internal connection string>
JWT_SECRET=<long random secret>
JWT_REFRESH_SECRET=<long random secret>

DAILY_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=CIBI <no-reply@crobic.org>
RESEND_REPLY_TO=

ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=

SENTRY_DSN=
```

Optional only if you still want Bunny for PDFs/documents:

```env
BUNNY_STORAGE_ZONE=
BUNNY_STORAGE_ACCESS_KEY=
BUNNY_STORAGE_REGION=
BUNNY_CDN_BASE_URL=
BUNNY_TOKEN_AUTH_KEY=
```

Set these on Vercel frontend:

```env
VITE_API_URL=https://api.crobic.org/api
VITE_SENTRY_DSN=
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

## Install and test locally

```powershell
cd "C:\Users\ETRAVELAR MOSES\Desktop\crobic-platform"

npm install --prefix server
npm install --prefix client

cd server
npx prisma generate
npx prisma migrate dev
npm run dev
```

In another terminal:

```powershell
cd "C:\Users\ETRAVELAR MOSES\Desktop\crobic-platform\client"
npm run dev
```

## Production build

Render build command:

```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

Render start command:

```bash
npm start
```

Vercel build command:

```bash
npm install && npm run build
```

## Important notes

- Auth now uses HttpOnly Secure SameSite=Strict cookies, not localStorage.
- Recorded course videos now use storage-saving YouTube links instead of uploading MP4 files to Bunny/Render.
- Students play videos inside a custom CIBI player with hidden YouTube redirect/download controls.
- Bunny remains available only for optional document/file storage if you decide to use it.
- Go Live sends Resend email, creates in-app notifications, and can trigger OneSignal if configured.
- Daily.co endpoints are backend-only and generate short-lived join tokens.
- `.env`, `node_modules`, builds, local SQLite DB, and uploads are excluded from the updated zip.
