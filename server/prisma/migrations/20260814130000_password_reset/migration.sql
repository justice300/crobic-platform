-- Password-reset tokens are hashed and expire after one hour.
-- IF NOT EXISTS keeps this safe for environments that already received the columns manually.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_passwordResetTokenHash_passwordResetExpiresAt_idx"
  ON "User"("passwordResetTokenHash", "passwordResetExpiresAt");
