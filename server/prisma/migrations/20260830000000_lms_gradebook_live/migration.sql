-- Add programme-level live class targeting.
ALTER TABLE "LiveSession"
ADD COLUMN "programmeId" INTEGER;

CREATE INDEX "LiveSession_programmeId_idx"
ON "LiveSession"("programmeId");

ALTER TABLE "LiveSession"
ADD CONSTRAINT "LiveSession_programmeId_fkey"
FOREIGN KEY ("programmeId") REFERENCES "Programme"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
