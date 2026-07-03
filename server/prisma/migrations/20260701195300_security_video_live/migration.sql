-- Production security, protected course videos, Bunny documents, Go Live sessions, notifications.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;

ALTER TABLE "LiveSession"
  ADD COLUMN IF NOT EXISTS "startedById" INTEGER,
  ADD COLUMN IF NOT EXISTS "recordingUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS "dailyRoomName" TEXT,
  ADD COLUMN IF NOT EXISTS "dailyRoomUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LiveSession_startedById_fkey'
  ) THEN
    ALTER TABLE "LiveSession"
    ADD CONSTRAINT "LiveSession_startedById_fkey"
    FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LiveSession_startedById_idx" ON "LiveSession"("startedById");
CREATE INDEX IF NOT EXISTS "LiveSession_status_idx" ON "LiveSession"("status");

CREATE TABLE IF NOT EXISTS "CourseVideo" (
  "id" SERIAL PRIMARY KEY,
  "courseId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "bunnyPath" TEXT NOT NULL,
  "cdnUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "chapter" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 1,
  "uploadedById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseVideo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CourseVideo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CourseVideo_courseId_idx" ON "CourseVideo"("courseId");
CREATE INDEX IF NOT EXISTS "CourseVideo_uploadedById_idx" ON "CourseVideo"("uploadedById");
CREATE INDEX IF NOT EXISTS "CourseVideo_sortOrder_idx" ON "CourseVideo"("sortOrder");

CREATE TABLE IF NOT EXISTS "CourseVideoProgress" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "videoId" INTEGER NOT NULL,
  "progressSecond" INTEGER NOT NULL DEFAULT 0,
  "durationSecond" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseVideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CourseVideoProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "CourseVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CourseVideoProgress_userId_videoId_key" ON "CourseVideoProgress"("userId", "videoId");
CREATE INDEX IF NOT EXISTS "CourseVideoProgress_videoId_idx" ON "CourseVideoProgress"("videoId");

CREATE TABLE IF NOT EXISTS "CourseDocument" (
  "id" SERIAL PRIMARY KEY,
  "courseId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "bunnyPath" TEXT NOT NULL,
  "cdnUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "uploadedById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseDocument_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CourseDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CourseDocument_courseId_idx" ON "CourseDocument"("courseId");
CREATE INDEX IF NOT EXISTS "CourseDocument_uploadedById_idx" ON "CourseDocument"("uploadedById");

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "courseId" INTEGER,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "url" TEXT,
  "type" TEXT NOT NULL DEFAULT 'INFO',
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_courseId_idx" ON "Notification"("courseId");
CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");
