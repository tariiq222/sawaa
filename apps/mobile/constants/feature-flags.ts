/**
 * Mobile feature flags.
 *
 * Set to `false` to hide unfinished features at the entry point. Existing
 * screens stay buildable + tested so flipping the flag re-enables them
 * without scaffolding work.
 *
 * - `videoCalls`: keep `false` until the Zoom SDK is integrated. The
 *   `VideoCallScreen` UI exists and is unit-tested, but no real call
 *   placement happens yet. Flipping to `true` exposes the entry routes
 *   and the join/start button on appointment cards.
 */
export const FEATURE_FLAGS = {
  videoCalls: false,
} as const;
