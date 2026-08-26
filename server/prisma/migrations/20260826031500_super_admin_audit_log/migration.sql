CREATE TABLE IF NOT EXISTS "AdminActivityLog" (
  "id" SERIAL PRIMARY KEY,
  "adminId" INTEGER,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "details" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "AdminActivityLog"
  ADD COLUMN IF NOT EXISTS "adminId" INTEGER,
  ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS "entityType" TEXT,
  ADD COLUMN IF NOT EXISTS "entityId" TEXT,
  ADD COLUMN IF NOT EXISTS "details" TEXT,
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  ALTER TABLE "AdminActivityLog"
  ADD CONSTRAINT "AdminActivityLog_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "AdminActivityLog_adminId_idx" ON "AdminActivityLog"("adminId");
CREATE INDEX IF NOT EXISTS "AdminActivityLog_action_idx" ON "AdminActivityLog"("action");
CREATE INDEX IF NOT EXISTS "AdminActivityLog_createdAt_idx" ON "AdminActivityLog"("createdAt");
