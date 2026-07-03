# CIBI Security + Video + Go Live Changelog

## Backend

Changed:
- `server/package.json`
- `server/.env.example`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260701195300_security_video_live/migration.sql`
- `server/src/db.js`
- `server/src/index.js`
- `server/src/middleware.js`

Added:
- `server/src/security.js`
- `server/src/storage.js`
- `server/src/integrations.js`
- `server/src/sentry.js`
- `render.yaml`

### Security
- Added Helmet with CSP, HSTS, referrer policy, frame policy and content-type protection.
- Removed `X-Powered-By`, disabled etag, and added no-referrer policy.
- Locked CORS to configured frontend origins only.
- Added login/register/OTP rate limits and progressive slowdown.
- Added global sanitization for request body/query/params.
- Added production-safe global error handler.
- Added HTTPS redirect in production.
- Added Cloudflare/Render proxy trust.
- Added account lock after 5 failed login attempts.
- Changed bcrypt hashing to salt round 12.
- Moved auth to HttpOnly Secure SameSite=Strict cookies with 15-minute access tokens and 7-day refresh token rotation.
- Added logout token invalidation.
- Added database health check and graceful shutdown.

### Course Videos
- Replaced cloud video upload with YouTube-link video saving to reduce storage and bandwidth cost.
- Kept endpoint path for compatibility:
  - `POST /api/courses/:courseId/videos/upload`
- Added protected player-data endpoint:
  - `GET /api/courses/:courseId/videos/:videoId/stream-url`
- Added edit/delete/reorder/progress endpoints:
  - `PATCH /api/courses/:courseId/videos/:videoId`
  - `DELETE /api/courses/:courseId/videos/:videoId`
  - `PATCH /api/courses/:courseId/videos/reorder`
  - `POST /api/courses/:courseId/videos/:videoId/progress`
- Added document upload endpoint:
  - `POST /api/courses/:courseId/documents/upload`
- Course videos no longer use file uploads. They save YouTube links only.
- Document uploads still use multer memory storage.
- Document max size: 10MB.
- Allowed document types: pdf, docx, jpg, png.

### Go Live
- Added course-level live endpoints:
  - `POST /api/courses/:courseId/live/start`
  - `PATCH /api/courses/:courseId/live/:sessionId/end`
  - `GET /api/courses/:courseId/live/active`
  - `GET /api/courses/:courseId/live/history`
  - `PATCH /api/courses/:courseId/live/:sessionId/recording`
- Validates Zoom/YouTube links.
- Sends Resend HTML emails.
- Adds in-app notifications.
- Sends OneSignal push notifications when configured.

### Daily.co
- Added Daily room and join-token endpoints:
  - `POST /api/courses/:courseId/daily/room`
  - `POST /api/courses/:courseId/daily/join-token`
  - `DELETE /api/courses/:courseId/daily/room/:roomName`

## Frontend

Changed:
- `client/package.json`
- `client/.env.example`
- `client/src/api.js`
- `client/src/main.jsx`
- `client/src/styles.css`

Added:
- `client/vercel.json`

### Frontend updates
- Removed localStorage token auth.
- Added cookie-based API calls with automatic token refresh on 401.
- Removed frontend video file upload flow and replaced it with a YouTube link modal and CIBI custom player.
- Added Sentry frontend initialization.
- Added DOMPurify dependency for safe HTML rendering if HTML rendering is added later.
- Added notification bell with live class notifications.
- Added Add Video modal inside existing Course Builder/Course Detail area.
- Added secure course video list and player inside existing course pages.
- Added Go Live manager inside Course Builder.
- Added student live banner and past live classes inside existing course detail page.


## CIBI Rebrand Update

- Changed public-facing name from CROBIC to CIBI.
- Changed institution name from Champions Royal Bible College to Champion International Bible Institute.
- Updated navbar brand to show CIBI, Champion International Bible Institute, and Formerly CROBIC.
- Added a Prisma migration to update existing Settings rows from the old public name to the new brand name.
