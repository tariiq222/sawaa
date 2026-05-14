import { sawaaTokens, getBrandingTokens } from '@/theme/sawaa/tokens';
import { SawaaButton, SawaaCard, SawaaText } from '@/theme/sawaa/components';

describe('Theme Tokens System', () => {
  it('should export complete token system', () => {
    expect(sawaaTokens.colors).toBeDefined();
    expect(sawaaTokens.primary).toBeDefined();
    expect(sawaaTokens.secondary).toBeDefined();
    expect(sawaaTokens.accent).toBeDefined();
    expect(sawaaTokens.radius).toBeDefined();
    expect(sawaaTokens.spacing).toBeDefined();
  });

  it('should support branding override', () => {
    const custom = getBrandingTokens({ primaryColor: '#FF0000', primaryColorDark: '#CC0000' });
    expect(custom.primary.light).toBe('#FF0000');
    expect(custom.primary.dark).toBe('#CC0000');
    // Other tokens should be unchanged
    expect(custom.accent).toEqual(sawaaTokens.accent);
  });

  it('should provide unified component definitions', () => {
    expect(SawaaButton.primary).toBeDefined();
    expect(SawaaButton.secondary).toBeDefined();
    expect(SawaaCard.container).toBeDefined();
    expect(SawaaText.heading).toBeDefined();
  });

  it('uses Deqah defaults for the locked Sawaa token fallback', () => {
    expect(sawaaTokens.primary.light).toBe('#354FD8');
    expect(sawaaTokens.primary.dark).toBe('#2438B0');
    expect(sawaaTokens.accent.light).toBe('#82CC17');
    expect(sawaaTokens.accent.dark).toBe('#5A9010');
  });

  it('should NOT contain hardcoded hex colors in component definitions', () => {
    const path = require('path');
    const componentFile = require('fs').readFileSync(
      path.join(__dirname, '../theme/sawaa/components.ts'),
      'utf8'
    );
    // Only whitelist: sawaaTokens references, comment markers, and necessary strings
    // Should fail if we find standalone #[0-9a-f]{6} outside of token references
    const illegitHex = componentFile.match(/#[0-9a-f]{6}(?!.*sawaaTokens)/gi);
    expect(illegitHex).toBeNull();
  });
});
