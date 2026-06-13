// Fair ordering for the daily cron's per-user digest generation.
//
// The cron generates digests sequentially in a single function invocation. If
// the platform kills the function on its execution-time limit before the loop
// finishes, users later in the order never get a digest — and the kill happens
// outside the per-user try/catch, so the starvation is silent.
//
// Ordering by staleness (oldest digest first, never-generated first) makes any
// residual cutoff rotate fairly: whoever is most overdue is generated first, so
// no account is permanently starved even when the budget can't cover everyone.

export interface StalenessItem<T> {
  item: T;
  // Most recent digest date as an ISO "YYYY-MM-DD" string, or null if the user
  // has never had a digest generated.
  lastDigestDate: string | null;
}

export function orderByStaleness<T>(items: StalenessItem<T>[]): T[] {
  return [...items]
    .sort((a, b) => {
      // Never-generated users are the most stale → front of the line.
      if (a.lastDigestDate === null && b.lastDigestDate === null) return 0;
      if (a.lastDigestDate === null) return -1;
      if (b.lastDigestDate === null) return 1;
      // ISO date strings sort lexicographically; older (smaller) comes first.
      if (a.lastDigestDate < b.lastDigestDate) return -1;
      if (a.lastDigestDate > b.lastDigestDate) return 1;
      return 0;
    })
    .map((x) => x.item);
}
