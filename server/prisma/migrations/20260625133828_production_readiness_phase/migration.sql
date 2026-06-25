-- CreateTable
CREATE TABLE "AdminActivityLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adminId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminActivityLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseDiscussion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "courseId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseDiscussion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseDiscussion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseDiscussionReply" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discussionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseDiscussionReply_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "CourseDiscussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseDiscussionReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdminActivityLog_adminId_idx" ON "AdminActivityLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminActivityLog_action_idx" ON "AdminActivityLog"("action");

-- CreateIndex
CREATE INDEX "AdminActivityLog_createdAt_idx" ON "AdminActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "CourseDiscussion_courseId_idx" ON "CourseDiscussion"("courseId");

-- CreateIndex
CREATE INDEX "CourseDiscussion_userId_idx" ON "CourseDiscussion"("userId");

-- CreateIndex
CREATE INDEX "CourseDiscussion_status_idx" ON "CourseDiscussion"("status");

-- CreateIndex
CREATE INDEX "CourseDiscussionReply_discussionId_idx" ON "CourseDiscussionReply"("discussionId");

-- CreateIndex
CREATE INDEX "CourseDiscussionReply_userId_idx" ON "CourseDiscussionReply"("userId");
