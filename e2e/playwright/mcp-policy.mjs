import { isAbsolute, relative, resolve } from 'node:path';

// Playwright's file tools only check paths against the workspace root (or not
// at all), so the MCP launcher keeps every explicit file path, read or write,
// under e2e/playwright/.
// browser_navigate is checked here too; playwright.local.config.ts blocks all
// other origins at the browser level (evaluate, run_code, clicked links).
export function createMcpPolicy(root, ports) {
  const testRoot = resolve(root, 'e2e/playwright');
  const writers = new Set(['planner_save_plan', 'generator_write_test']);
  const allowedOrigins = new Set(ports.map(port => `http://127.0.0.1:${port}`));
  return function policyViolation(message) {
    if (message?.method !== 'tools/call') return null;
    const { name, arguments: input = {} } = message.params ?? {};
    // Writer tools need a path; other tools may take optional paths they read
    // (seedFile, upload paths) or write (screenshot, evaluate output).
    const paths = Object.entries(input).filter(([key]) => /^(file_?name|seed_?file)$/i.test(key))
      .concat(Array.isArray(input.paths) ? input.paths.map(value => ['paths', value]) : []);
    if (writers.has(name) && !paths.some(([key]) => /^file_?name$/i.test(key))) return `${name}: fileName must be a relative path under e2e/playwright/`;
    if (input.paths !== undefined && !Array.isArray(input.paths)) return `${name}: paths must be a list of paths under e2e/playwright/`;
    for (const [key, value] of paths) {
      if (value === undefined && !writers.has(name)) continue;
      if (typeof value !== 'string' || isAbsolute(value)) return `${name}: ${key} must be a relative path under e2e/playwright/`;
      const inside = relative(testRoot, resolve(root, value));
      if (!inside || inside.startsWith('..') || isAbsolute(inside)) return `${name}: ${key} must be under e2e/playwright/`;
    }
    if (name === 'browser_navigate') {
      let origin = null;
      try { origin = new URL(input.url).origin; } catch {}
      if (!allowedOrigins.has(origin)) return `browser_navigate: only ${[...allowedOrigins].join(', ')} are allowed`;
    }
    return null;
  };
}
