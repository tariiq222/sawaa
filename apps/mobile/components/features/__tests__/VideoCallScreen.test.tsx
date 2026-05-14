import * as fs from 'fs';
import * as path from 'path';

/**
 * Guardrail: the rebuilt VideoCallScreen must not contain any of the
 * mock/demo strings or hardcoded fake durations from the legacy screen.
 * If any of these reappear in source, the screen has regressed back to
 * the silhouette + "754s timer" mock UI.
 */
describe('VideoCallScreen source — no mock leftovers', () => {
  const file = path.resolve(__dirname, '..', 'VideoCallScreen.tsx');
  const src = fs.readFileSync(file, 'utf8');

  it('does not contain the legacy 754-second placeholder timer', () => {
    expect(src).not.toMatch(/\b754\b/);
  });

  it('does not contain hardcoded therapist names', () => {
    expect(src).not.toMatch(/فاطمة العمران/);
    expect(src).not.toMatch(/Fatima Al-?Omran/i);
  });

  it('does not contain the static "deep breath, Sara" caption', () => {
    expect(src).not.toMatch(/خذي نفساً/);
    expect(src).not.toMatch(/Take a deep breath/i);
  });

  it('does not contain hardcoded user "Sara" / "س" labels', () => {
    expect(src).not.toMatch(/'سارة'/);
  });
});
