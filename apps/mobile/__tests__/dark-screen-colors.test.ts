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

// Expo Router layout files configure navigation rather than painting a screen;
// other exceptions redirect or reuse a screen checked separately by this scan.
// The chat route only redirects.
const backgroundExceptions = new Set([
  '(auth)/_layout.tsx',
  '(auth)/register.tsx', // Re-exports email-entry.tsx, whose shared background is checked.
  '(client)/_layout.tsx',
  '(client)/(tabs)/_layout.tsx',
  '(employee)/_layout.tsx',
  '(employee)/(tabs)/_layout.tsx',
  '(guest)/_layout.tsx',
  '_layout.tsx',
  '(client)/chat.tsx',
  '(guest)/home.tsx',
  '(client)/(tabs)/account.tsx',
  'public-booking/[serviceId].tsx',
  'public-booking/service.tsx',
  'public-booking/schedule.tsx',
  'public-booking/confirm.tsx',
  'public-clinic/[id].tsx',
]);

function paintsSharedBackground(source: string): boolean {
  return source.includes('<AquaBackground') ||
    source.includes('<SettingsScaffold') ||
    source.includes('<VideoCallScreen');
}

describe('route color migration safeguards', () => {
  it('every screen route paints the shared background or is an explicit navigation exception', () => {
    const uncovered = routes.flatMap((file) => {
      const route = path.relative(appRoot, file).split(path.sep).join('/');
      const source = fs.readFileSync(file, 'utf8');
      if (backgroundExceptions.has(route) || paintsSharedBackground(source)) return [];
      return [route];
    });

    expect(uncovered).toEqual([]);
    for (const exception of backgroundExceptions) {
      expect(routes.map((file) => path.relative(appRoot, file).split(path.sep).join('/'))).toContain(exception);
    }
  });
  it.each(routes.map((file) => [path.relative(appRoot, file), file]))('%s does not import the fixed light palette', (_name, file) => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).not.toMatch(/import\s*\{[^}]*\bsawaaColors\b[^}]*\}/s);
    expect(source).not.toMatch(/sawaaTokens\.colors/);
  });

  it('settings save pairs an action fill with its on-action foreground', () => {
    const source = fs.readFileSync(path.join(appRoot, '../components/features/settings/SettingsProfileSection.tsx'), 'utf8');
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
    // The clinic and therapist directories render through shared cards that read
    // the palette themselves, so only the appointments list keeps a screen-level factory.
    for (const name of ['(tabs)/appointments.tsx']) {
      const source = fs.readFileSync(path.join(appRoot, '(client)', name), 'utf8');
      const styleFactory = name === '(tabs)/appointments.tsx' ? 'createAppointmentsStyles' : 'createStyles';
      expect(source).toContain(`useMemo(() => ${styleFactory}(colors), [colors])`);
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
