/** Client display timing only. Server authorization remains authoritative. */
export function videoJoinWindow(scheduledAt: string, durationMins: number, now: number) {
  const start = Date.parse(scheduledAt);
  const endsAt = start + durationMins * 60_000;
  if (!Number.isFinite(start) || !Number.isFinite(endsAt) || !Number.isFinite(now) || !Number.isFinite(durationMins) || durationMins <= 0) return null;
  const opensAt = start - 15 * 60_000;
  return {
    opensAt,
    endsAt,
    withinWindow: now >= opensAt && now <= endsAt,
    minutesUntilOpen: Math.max(1, Math.round((opensAt - now) / 60_000)),
  };
}
