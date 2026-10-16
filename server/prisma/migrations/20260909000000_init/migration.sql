CREATE TYPE "ReadingStatus" AS ENUM ('want_to_read', 'reading', 'finished', 'dnf');
CREATE TYPE "ProgressDisplayMode" AS ENUM ('pages', 'percentage');

CREATE TABLE "User" ("id" UUID NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Session" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "refreshTokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Session_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Author" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Author_pkey" PRIMARY KEY ("id"));
CREATE TABLE "BookWork" ("id" UUID NOT NULL, "title" TEXT NOT NULL, "originalTitle" TEXT, "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BookWork_pkey" PRIMARY KEY ("id"));
CREATE TABLE "WorkAuthor" ("workId" UUID NOT NULL, "authorId" UUID NOT NULL, CONSTRAINT "WorkAuthor_pkey" PRIMARY KEY ("workId", "authorId"));
CREATE TABLE "Edition" ("id" UUID NOT NULL, "workId" UUID NOT NULL, "isbn" TEXT, "publisher" TEXT, "publicationYear" INTEGER, "pageCount" INTEGER NOT NULL, "coverUri" TEXT, "language" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Edition_pkey" PRIMARY KEY ("id"));
CREATE TABLE "BookCopy" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "editionId" UUID NOT NULL, "status" "ReadingStatus" NOT NULL DEFAULT 'want_to_read', "currentPage" INTEGER NOT NULL DEFAULT 0, "spineColor" TEXT NOT NULL DEFAULT '#2C4A3E', "spineWidth" DOUBLE PRECISION NOT NULL DEFAULT 64, "spineHeight" DOUBLE PRECISION NOT NULL DEFAULT 180, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BookCopy_pkey" PRIMARY KEY ("id"));
CREATE TABLE "UserSettings" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "progressDisplayMode" "ProgressDisplayMode" NOT NULL DEFAULT 'pages', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");
CREATE UNIQUE INDEX "Author_name_key" ON "Author"("name");
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Edition_workId_idx" ON "Edition"("workId");
CREATE INDEX "BookCopy_userId_idx" ON "BookCopy"("userId");
CREATE INDEX "BookCopy_editionId_idx" ON "BookCopy"("editionId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAuthor" ADD CONSTRAINT "WorkAuthor_workId_fkey" FOREIGN KEY ("workId") REFERENCES "BookWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAuthor" ADD CONSTRAINT "WorkAuthor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_workId_fkey" FOREIGN KEY ("workId") REFERENCES "BookWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
