import { getSawaaRoles } from '../tokens';

const SCHEMES = ['light', 'dark'] as const;

function luminance(hex: string): number {
  const channels = hex
    .replace('#', '')
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

describe('selected segment colour', () => {
  // The pill sits on a translucent glass track; surfaceHigh is the lightest
  // surface behind it, so it is the favourable case to hold the floor against.
  it.each(SCHEMES)('separates the selected pill from the track in %s', (scheme) => {
    const roles = getSawaaRoles(scheme);
    expect(contrast(roles.selection.fill, roles.surfaceHigh)).toBeGreaterThanOrEqual(3);
  });

  it.each(SCHEMES)('keeps the selected label readable in %s', (scheme) => {
    const roles = getSawaaRoles(scheme);
    expect(contrast(roles.selection.foreground, roles.selection.fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('does not reuse the call-to-action fill in dark mode', () => {
    const dark = getSawaaRoles('dark');
    expect(dark.selection.fill).not.toBe(dark.action.fill);
  });
});

describe('switch colour', () => {
  // The old off track was `surfaceLow`: 1.04:1 against the card, i.e. the whole
  // control disappeared. Hold the track above the point where it reads as a shape.
  it.each(SCHEMES)('keeps an off switch visible against the card in %s', (scheme) => {
    const roles = getSawaaRoles(scheme);
    expect(contrast(roles.switch.trackOff, roles.surface)).toBeGreaterThanOrEqual(1.4);
  });

  it.each(SCHEMES)('keeps the knob readable on an off switch in %s', (scheme) => {
    const roles = getSawaaRoles(scheme);
    expect(contrast(roles.switch.thumbOff, roles.switch.trackOff)).toBeGreaterThanOrEqual(1.5);
  });

  it.each(SCHEMES)('keeps the knob readable on an on switch in %s', (scheme) => {
    const roles = getSawaaRoles(scheme);
    expect(contrast(roles.switch.thumbOn, roles.switch.trackOn)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SCHEMES)('separates the on track from the off track in %s', (scheme) => {
    const roles = getSawaaRoles(scheme);
    expect(contrast(roles.switch.trackOn, roles.switch.trackOff)).toBeGreaterThanOrEqual(1.5);
  });
});


