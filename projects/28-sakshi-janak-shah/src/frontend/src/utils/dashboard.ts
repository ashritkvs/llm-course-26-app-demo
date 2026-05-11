import type { DashboardPoint, DashboardSummary, JournalEntry } from "../types";

const WEEKDAY_ORDER = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function signedScore(point: JournalEntry) {
  if (point.result.category === "positive") {
    return point.result.intensity;
  }
  if (point.result.category === "negative") {
    return -point.result.intensity;
  }
  return 0;
}

function longestStreak(points: DashboardPoint[], target: "positive" | "negative") {
  let current = 0;
  let best = 0;

  for (const point of points) {
    if (point.category === target) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

export function buildDashboard(entries: JournalEntry[]): DashboardSummary | null {
  if (!entries.length) {
    return null;
  }

  const points = [...entries]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-7)
    .map<DashboardPoint>((entry) => ({
      date: entry.createdAt,
      moodScore: entry.result.intensity,
      signedScore: signedScore(entry),
      category: entry.result.category,
      emotion: entry.result.emotion,
      trigger: entry.result.trigger
    }));

  const averageMood = Number(
    (points.reduce((sum, point) => sum + point.moodScore, 0) / points.length).toFixed(1)
  );
  const bestMood = Math.max(...points.map((point) => point.moodScore));
  const lowestMood = Math.min(...points.map((point) => point.moodScore));
  const positiveStreak = longestStreak(points, "positive");
  const negativeStreak = longestStreak(points, "negative");

  const triggerCounts = new Map<string, number>();
  const weekdayBuckets = new Map<string, number[]>();

  for (const point of points) {
    triggerCounts.set(point.trigger, (triggerCounts.get(point.trigger) ?? 0) + 1);

    const weekday = WEEKDAY_ORDER[new Date(point.date).getDay()];
    const bucket = weekdayBuckets.get(weekday) ?? [];
    bucket.push(point.signedScore);
    weekdayBuckets.set(weekday, bucket);
  }

  const topTrigger =
    [...triggerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Not enough data yet";

  const weekdayAverages = [...weekdayBuckets.entries()].map(([weekday, scores]) => ({
    weekday,
    average: scores.reduce((sum, score) => sum + score, 0) / scores.length
  }));

  const sortedWeekdays = weekdayAverages.sort((a, b) => b.average - a.average);

  return {
    averageMood,
    bestMood,
    lowestMood,
    positiveStreak,
    negativeStreak,
    topTrigger,
    bestDay: sortedWeekdays[0]?.weekday ?? "N/A",
    toughestDay: sortedWeekdays[sortedWeekdays.length - 1]?.weekday ?? "N/A",
    points
  };
}
