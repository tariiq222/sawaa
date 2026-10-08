import { getSawaaRoles } from '../tokens';
import { buildTheme } from '../../tokens';

function luminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .slice(0, 6)
    .match(/../g)!
    .map((pair) => parseInt(pair, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Composite a foreground color at `alpha` over an opaque background. */
function compositeAlpha(fgHex: string, alpha: number, bgHex: string): string {
  const fg = fgHex.replace('#', '').match(/../g)!.map((p) => parseInt(p, 16));
  const bg = bgHex.replace('#', '').match(/../g)!.map((p) => parseInt(p, 16));
  const r = Math.round(fg[0] * alpha + bg[0] * (1 - alpha));
  const g = Math.round(fg[1] * alpha + bg[1] * (1 - alpha));
  const b = Math.round(fg[2] * alpha + bg[2] * (1 - alpha));
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

describe('WCAG AA contrast — normal text >= 4.5:1', () => {
  describe('light mode', () => {
    const theme = buildTheme(null, 'light');
    const roles = getSawaaRoles('light');
    const surfaces = [roles.surface, roles.surfaceLow, roles.background];

    it('textPrimary meets 4.5:1 on all light opaque surfaces', () => {
      for (const surface of surfaces) {
        expect(contrast(theme.colors.textPrimary, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('textSecondary meets 4.5:1 on all light opaque surfaces', () => {
      for (const surface of surfaces) {
        expect(contrast(theme.colors.textSecondary, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('textMuted meets 4.5:1 on all light opaque surfaces', () => {
      for (const surface of surfaces) {
        expect(contrast(theme.colors.textMuted, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('all status foreground colors meet 4.5:1 on the light surface', () => {
      const statusKeys = ['pending', 'confirmed', 'completed', 'cancelled', 'pendingCancellation'] as const;
      for (const key of statusKeys) {
        const value = theme.colors.status[key];
        expect(contrast(value, roles.surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('all payment foreground colors meet 4.5:1 on the light surface', () => {
      const paymentKeys = ['pending', 'paid', 'refunded', 'failed'] as const;
      for (const key of paymentKeys) {
        const value = theme.colors.payment[key];
        expect(contrast(value, roles.surface)).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  describe('dark mode', () => {
    const theme = buildTheme(null, 'dark');
    const roles = getSawaaRoles('dark');
    const surfaces = [roles.surface, roles.surfaceLow, roles.background];

    it('textPrimary meets 4.5:1 on all dark opaque surfaces', () => {
      for (const surface of surfaces) {
        expect(contrast(theme.colors.textPrimary, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('textSecondary meets 4.5:1 on all dark opaque surfaces', () => {
      for (const surface of surfaces) {
        expect(contrast(theme.colors.textSecondary, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('textMuted meets 4.5:1 on all dark opaque surfaces', () => {
      for (const surface of surfaces) {
        expect(contrast(theme.colors.textMuted, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('all status foreground colors meet 4.5:1 on the dark surface', () => {
      const statusKeys = ['pending', 'confirmed', 'completed', 'cancelled', 'pendingCancellation'] as const;
      for (const key of statusKeys) {
        const value = theme.colors.status[key];
        expect(contrast(value, roles.surface)).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe('StatusPill semantic contrast', () => {
  it('light mode statusForeground provides >= 4.5:1 on composited pill backgrounds', () => {
    const theme = buildTheme(null, 'light');
    const fgMap = theme.colors.statusForeground as Record<string, string> | null;
    expect(fgMap).not.toBeNull();

    const surface = getSawaaRoles('light').surface;
    const statuses: Record<string, string> = {
      pending: theme.colors.status.pending,
      confirmed: theme.colors.status.confirmed,
      completed: theme.colors.status.completed,
      cancelled: theme.colors.status.cancelled,
      pendingCancellation: theme.colors.status.pendingCancellation,
      paid: theme.colors.payment.paid,
      refunded: theme.colors.payment.refunded,
      failed: theme.colors.payment.failed,
    };

    for (const [status, bgColor] of Object.entries(statuses)) {
      const fgColor = fgMap![status];
      if (!fgColor) continue;
      // The pill composites the bg color at 14% alpha over the surface.
      const pillBg = compositeAlpha(bgColor, 0.14, surface);
      const ratio = contrast(fgColor, pillBg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dark mode uses accent colors directly without a separate foreground map', () => {
    const theme = buildTheme(null, 'dark');
    // Dark mode accents are already bright enough; no foreground override needed.
    expect(theme.colors.statusForeground).toBeNull();
    const surface = getSawaaRoles('dark').surface;
    const darkStatuses = [
      theme.colors.status.pending,
      theme.colors.status.confirmed,
      theme.colors.status.completed,
      theme.colors.status.cancelled,
    ];
    for (const color of darkStatuses) {
      expect(contrast(color, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

it.each(['light', 'dark'] as const)('danger text is readable in %s', scheme => {
  const { danger } = getSawaaRoles(scheme);
  expect(contrast(danger.fill, danger.foreground)).toBeGreaterThanOrEqual(4.5);
});
