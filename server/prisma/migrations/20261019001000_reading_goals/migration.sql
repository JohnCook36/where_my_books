CREATE TABLE "ReadingGoal" (
  "userId" UUID NOT NULL,
  "finishedBooksTarget" INTEGER NOT NULL DEFAULT 12,
  "weeklyMinutesTarget" INTEGER NOT NULL DEFAULT 180,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReadingGoal_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "ReadingGoal" ADD CONSTRAINT "ReadingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingGoal" ADD CONSTRAINT "ReadingGoal_books_target_check" CHECK ("finishedBooksTarget" BETWEEN 1 AND 500);
ALTER TABLE "ReadingGoal" ADD CONSTRAINT "ReadingGoal_minutes_target_check" CHECK ("weeklyMinutesTarget" BETWEEN 10 AND 10080);
