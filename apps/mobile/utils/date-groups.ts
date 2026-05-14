export interface DateGroup<T> {
  title: string;
  data: T[];
}

function stripTime(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Groups items by date into "Today", "Yesterday", and "Earlier" sections.
 * Items must have a `createdAt` ISO string field.
 */
export function groupByDate<T extends { createdAt: string }>(
  items: T[],
  language: 'ar' | 'en',
): DateGroup<T>[] {
  const now = new Date();
  const todayMs = stripTime(now);
  const yesterdayMs = todayMs - 86_400_000;

  const labels = {
    today: language === 'ar' ? '\u0627\u0644\u064A\u0648\u0645' : 'Today',
    yesterday: language === 'ar' ? '\u0623\u0645\u0633' : 'Yesterday',
    earlier: language === 'ar' ? '\u0623\u0642\u062F\u0645' : 'Earlier',
  };

  const buckets: Record<string, T[]> = {
    [labels.today]: [],
    [labels.yesterday]: [],
    [labels.earlier]: [],
  };

  for (const item of items) {
    const itemMs = stripTime(new Date(item.createdAt));
    if (itemMs >= todayMs) {
      buckets[labels.today].push(item);
    } else if (itemMs >= yesterdayMs) {
      buckets[labels.yesterday].push(item);
    } else {
      buckets[labels.earlier].push(item);
    }
  }

  return Object.entries(buckets)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}
