import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * NativeTabs registers only the screens declared as `<NativeTabs.Trigger>`
 * (useOnlyUserDefinedScreens). Any other route file inside a `(tabs)` group is
 * silently unreachable: pushing to it goes nowhere. This happened to
 * `(client)/(tabs)/records` and `(client)/(tabs)/chat`. Non-tab screens belong
 * in the parent stack instead.
 */
const appRoot = resolve(__dirname, '../app');
const tabGroups = ['(client)/(tabs)', '(employee)/(tabs)'];

function declaredTriggers(layoutSource: string): string[] {
  return [...layoutSource.matchAll(/<NativeTabs\.Trigger\b[^>]*?\bname="([^"]+)"/g)].map((m) => m[1]);
}

function routeFiles(groupDir: string): string[] {
  return readdirSync(groupDir, { withFileTypes: true })
    .filter((entry) => entry.name !== '__tests__' && entry.name !== '_layout.tsx')
    .map((entry) => entry.name.replace(/\.tsx?$/, ''));
}

describe.each(tabGroups)('%s native tab routes', (group) => {
  const groupDir = resolve(appRoot, group);
  const triggers = declaredTriggers(readFileSync(resolve(groupDir, '_layout.tsx'), 'utf8'));

  it('declares at least one trigger (guards the parser itself)', () => {
    expect(triggers.length).toBeGreaterThan(0);
  });

  it('has a declared trigger for every route file in the group', () => {
    const unregistered = routeFiles(groupDir).filter((route) => !triggers.includes(route));
    expect(unregistered).toEqual([]);
  });

  it('has a route file for every declared trigger', () => {
    const files = routeFiles(groupDir);
    expect(triggers.filter((name) => !files.includes(name))).toEqual([]);
  });
});
