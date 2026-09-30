const JOIN_WINDOW_MS_BEFORE = 15 * 60 * 1000;

export type VideoJoinState = 'before' | 'open' | 'ended' | 'waiting';

/**
 * Pre-join state of a video appointment, for the copy of the pre-join screen only
 * (the join button keeps its own gating). The window is [start - 15 min, end].
 * `waiting` means the window is open but the meeting link is not ready yet.
 */
export function getVideoJoinState(params: {
  scheduledAt: string;
  durationMins: number;
  linkReady: boolean;
  now?: number;
}): VideoJoinState {
  const start = new Date(params.scheduledAt).getTime();
  if (Number.isNaN(start)) return 'waiting';
  const now = params.now ?? Date.now();
  const end = start + params.durationMins * 60 * 1000;
  if (now < start - JOIN_WINDOW_MS_BEFORE) return 'before';
  if (now > end) return 'ended';
  return params.linkReady ? 'open' : 'waiting';
}
