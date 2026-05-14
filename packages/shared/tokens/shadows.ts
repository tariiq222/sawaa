/**
 * Deqah Design System — Shadow Tokens
 * Rule: Never use pure black shadows — use #001551 tint
 *
 * Levels (from DS spec):
 *   subtle   → stat cards, sidebar (resting)
 *   ambient  → hover on action cards
 *   medium   → hover on stat cards
 *   elevated → dropdowns
 *   high     → calendar popup
 *   modal    → modals/dialogs
 */
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0,21,81,0.04)',
  md: '0 4px 24px rgba(0,21,81,0.04)',
  lg: '0 8px 32px rgba(0,21,81,0.06)',
  xl: '0 12px 40px rgba(0,21,81,0.08)',
  /* DS-specific named levels */
  subtle: '0 1px 3px rgba(0,21,81,0.03)',
  ambient: '0 4px 12px rgba(0,21,81,0.05)',
  medium: '0 8px 24px rgba(0,21,81,0.06)',
  elevated: '0 12px 36px rgba(0,21,81,0.10)',
  high: '0 16px 48px rgba(0,21,81,0.12)',
  modal: '0 20px 50px rgba(0,21,81,0.12)',
} as const;

// React Native shadow objects — #001551 tint
export const rnShadows = {
  none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  sm: { shadowColor: '#001551', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#001551', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: '#001551', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 6 },
  xl: { shadowColor: '#001551', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
} as const;
