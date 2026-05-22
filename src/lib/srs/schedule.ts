// Forgetting curve intervals in days for each review level.
// Level 0 = brand new card, never reviewed.
const INTERVALS_DAYS = [1, 3, 7, 14, 30, 90, 180];
const MAX_LEVEL = INTERVALS_DAYS.length;

export type ReviewResult = "again" | "good" | "easy";

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

export function initialDueDate(now: Date = new Date()): Date {
  return addDays(now, INTERVALS_DAYS[0]);
}

export function nextSchedule(
  currentLevel: number,
  result: ReviewResult,
  now: Date = new Date()
): { nextLevel: number; nextDueAt: Date } {
  let nextLevel: number;
  if (result === "again") {
    nextLevel = 0;
  } else if (result === "easy") {
    nextLevel = Math.min(currentLevel + 2, MAX_LEVEL);
  } else {
    nextLevel = Math.min(currentLevel + 1, MAX_LEVEL);
  }
  const days = INTERVALS_DAYS[Math.min(nextLevel, INTERVALS_DAYS.length - 1)];
  return {
    nextLevel,
    nextDueAt: addDays(now, days),
  };
}

export function isDue(nextDueAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!nextDueAt) return true;
  return new Date(nextDueAt).getTime() <= now.getTime();
}
