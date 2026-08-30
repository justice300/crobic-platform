-- Add lecturer-owned academic assessment records to each course/student relationship.
CREATE TABLE "LecturerAssessment" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "lecturerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'LECTURER_ASSESSMENT',
    "score" INTEGER,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LecturerAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LecturerAssessment_courseId_studentId_lecturerId_category_key"
ON "LecturerAssessment"("courseId", "studentId", "lecturerId", "category");

CREATE INDEX "LecturerAssessment_courseId_idx" ON "LecturerAssessment"("courseId");
CREATE INDEX "LecturerAssessment_studentId_idx" ON "LecturerAssessment"("studentId");
CREATE INDEX "LecturerAssessment_lecturerId_idx" ON "LecturerAssessment"("lecturerId");

ALTER TABLE "LecturerAssessment"
ADD CONSTRAINT "LecturerAssessment_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LecturerAssessment"
ADD CONSTRAINT "LecturerAssessment_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LecturerAssessment"
ADD CONSTRAINT "LecturerAssessment_lecturerId_fkey"
FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
