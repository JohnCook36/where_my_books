import { Injectable } from '@nestjs/common';
import type { ReadingGoals, ReadingStatsResponse, UpdateReadingGoalsRequest } from '@where-my-books/shared';
import { PrismaService } from '../prisma.service.js';

const defaults: ReadingGoals = { finishedBooksTarget: 12, weeklyMinutesTarget: 180 };

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string): Promise<ReadingStatsResponse> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
    const firstDay = new Date(today);
    firstDay.setUTCDate(today.getUTCDate() - 6);
    const [booksTotal, booksReading, booksFinished, sessions, lastSevenSessions, lastSevenEvents, allPageTotals, goal] = await Promise.all([
      this.prisma.bookCopy.count({ where: { userId } }),
      this.prisma.bookCopy.count({ where: { userId, status: 'reading' } }),
      this.prisma.bookCopy.count({ where: { userId, status: 'finished' } }),
      this.prisma.readingSession.aggregate({ where: { userId, finishedAt: { not: null } }, _count: { _all: true }, _sum: { durationSeconds: true } }),
      this.prisma.readingSession.findMany({ where: { userId, finishedAt: { gte: firstDay } }, select: { finishedAt: true, durationSeconds: true } }),
      this.prisma.readingProgressEvent.findMany({ where: { userId, createdAt: { gte: firstDay } }, select: { createdAt: true, fromPage: true, toPage: true } }),
      this.prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COALESCE(SUM(GREATEST("toPage" - "fromPage", 0)), 0)::bigint AS "total" FROM "ReadingProgressEvent" WHERE "userId" = CAST(${userId} AS UUID)`,
      this.prisma.readingGoal.findUnique({ where: { userId } }),
    ]);
    const daily: ReadingStatsResponse['daily'] = Array.from({ length: 7 }, (_unused, offset) => {
      const date = new Date(firstDay);
      date.setUTCDate(firstDay.getUTCDate() + offset);
      return { date: date.toISOString().slice(0, 10), minutes: 0, pagesAdvanced: 0 };
    });
    const byDate = new Map(daily.map(item => [item.date, item]));
    const seconds = new Map<string, number>();
    let weeklySeconds = 0;
    for (const session of lastSevenSessions) {
      if (!session.finishedAt) continue;
      const day = session.finishedAt.toISOString().slice(0, 10);
      seconds.set(day, (seconds.get(day) ?? 0) + (session.durationSeconds ?? 0));
      if (session.finishedAt >= weekStart) weeklySeconds += session.durationSeconds ?? 0;
    }
    for (const event of lastSevenEvents) {
      const item = byDate.get(event.createdAt.toISOString().slice(0, 10));
      if (item) item.pagesAdvanced += Math.max(0, event.toPage - event.fromPage);
    }
    for (const item of daily) item.minutes = Math.floor((seconds.get(item.date) ?? 0) / 60);
    // Current UTC week can span seven days; firstDay is six days before today.
    // With a Monday start both bounds are inside the displayed 7-day window.
    return {
      booksTotal, booksReading, booksFinished,
      completedSessions: sessions._count._all,
      totalMinutes: Math.floor((sessions._sum.durationSeconds ?? 0) / 60),
      totalPagesAdvanced: Number(allPageTotals[0]?.total ?? 0n),
      weeklyMinutes: Math.floor(weeklySeconds / 60),
      weekStartUtc: weekStart.toISOString().slice(0, 10),
      daily,
      goals: goal ? { finishedBooksTarget: goal.finishedBooksTarget, weeklyMinutesTarget: goal.weeklyMinutesTarget } : defaults,
    };
  }

  async updateGoals(userId: string, goals: UpdateReadingGoalsRequest): Promise<ReadingGoals> {
    const saved = await this.prisma.readingGoal.upsert({
      where: { userId },
      create: { userId, finishedBooksTarget: goals.finishedBooksTarget, weeklyMinutesTarget: goals.weeklyMinutesTarget },
      update: { finishedBooksTarget: goals.finishedBooksTarget, weeklyMinutesTarget: goals.weeklyMinutesTarget },
    });
    return { finishedBooksTarget: saved.finishedBooksTarget, weeklyMinutesTarget: saved.weeklyMinutesTarget };
  }
}
