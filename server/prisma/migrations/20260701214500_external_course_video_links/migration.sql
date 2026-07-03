-- Replace paid cloud video storage requirement with external YouTube links embedded inside the CIBI platform.
-- Existing Bunny video columns are kept but made optional so old records do not break.

ALTER TABLE "CourseVideo"
  ADD COLUMN IF NOT EXISTS "videoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'YOUTUBE',
  ADD COLUMN IF NOT EXISTS "externalVideoId" TEXT,
  ADD COLUMN IF NOT EXISTS "embedUrl" TEXT;

ALTER TABLE "CourseVideo"
  ALTER COLUMN "bunnyPath" DROP NOT NULL,
  ALTER COLUMN "cdnUrl" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "CourseVideo_provider_idx" ON "CourseVideo"("provider");
