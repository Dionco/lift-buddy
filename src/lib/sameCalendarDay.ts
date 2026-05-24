/**
 * True when two timestamps fall on the same local-time calendar day.
 *
 * "Same calendar day" is the rule for re-using a Readiness check across
 * session restarts — a lifter's morning check-in should still apply to an
 * evening retry on the same date, but a check from yesterday should not.
 * Local time (not UTC) matters because the lifter's day is anchored to
 * their wall clock.
 */
export function isSameCalendarDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
