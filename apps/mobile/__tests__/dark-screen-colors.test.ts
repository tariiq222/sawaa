import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(__dirname, '../app');
function routeFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__') return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(filename) : filename.endsWith('.tsx') ? [filename] : [];
  });
}
const routes = routeFiles(appRoot);

describe('route color migration safeguards', () => {
  it.each(routes.map((file) => [path.relative(appRoot, file), file]))('%s does not import the fixed light palette', (_name, file) => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).not.toMatch(/import\s*\{[^}]*\bsawaaColors\b[^}]*\}/s);
    expect(source).not.toMatch(/sawaaTokens\.colors/);
  });

  it('the profile switch uses the persisted theme setting, not local demo state', () => {
    const source = fs.readFileSync(path.join(appRoot, '(client)/profile.tsx'), 'utf8');
    expect(source).toContain("const darkMode = scheme === 'dark'");
    expect(source).toContain("setThemeMode(darkMode ? 'light' : 'dark')");
    expect(source).toContain("accessibilityRole={it.toggle !== undefined ? 'switch' : 'button'}");
    expect(source).not.toContain('setDarkMode');
  });

  it('settings save pairs an action fill with its on-action foreground', () => {
    const source = fs.readFileSync(path.join(appRoot, '(client)/settings-profile-section.tsx'), 'utf8');
    expect(source).toContain('theme.colors.primaryFill');
    expect(source).toContain('theme.colors.primaryForeground');
    expect(source).not.toMatch(/#1D4ED8/i);
  });

  it('the shared segmented control pairs its selection fill with its own foreground', () => {
    // Notification filters and appointment tabs both render through this control,
    // so the guarantee now lives here instead of in each route.
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/ui/GlassSegmented.tsx'),
      'utf8',
    );
    expect(source).toContain('theme.colors.primarySelection');
    expect(source).toContain('theme.colors.primarySelectionForeground');
    expect(source).not.toMatch(/#1D4ED8/i);
  });

  it('memoized client lists update their rendered content when the palette changes', () => {
    for (const name of ['clinics.tsx', 'therapists.tsx', '(tabs)/appointments.tsx']) {
      const source = fs.readFileSync(path.join(appRoot, '(client)', name), 'utf8');
      expect(source).toContain('useMemo(() => createStyles(colors), [colors])');
      expect(source).toMatch(/\[.*colors, styles/);
    }
  });

  it('video routes keep the shared explicit video presentation', () => {
    for (const role of ['client', 'employee']) {
      const source = fs.readFileSync(path.join(appRoot, `(${role})/video-call.tsx`), 'utf8');
      expect(source).toContain(`<VideoCallScreen role="${role}"`);
    }
  });
});
