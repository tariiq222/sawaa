import { execFileSync } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';

// Playwright's file tools only check paths against the workspace root (or not
// at all), so the MCP launcher keeps every explicit file path, read or write,
// under e2e/playwright/.
// browser_navigate is checked here too; playwright.local.config.ts blocks all
// other origins at the browser level (evaluate, run_code, clicked links).
// Specs run as unrestricted Node code, so agents may only load test code that a
// person has reviewed and committed: anything uncommitted under e2e/playwright/
// blocks every tool that loads specs. Git is the record, so this holds across
// MCP restarts and every run path (test_run, test_debug, test_list, setup).
export function unreviewedTestCode(root) {
  // --ignored: Playwright collects specs regardless of .gitignore.
  const entries = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=matching', '--', 'e2e/playwright'],
    { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  return entries.map(entry => entry.slice(3)).filter(path => /\.[cm]?[jt]sx?$/.test(path));
}

export function createMcpPolicy(root, ports, { unreviewed = () => unreviewedTestCode(root) } = {}) {
  const testRoot = resolve(root, 'e2e/playwright');
  const writers = new Set(['planner_save_plan', 'generator_write_test']);
  // browser_run_code hands model code the Node-side page object (page.screenshot
  // paths, setInputFiles), which no argument check can contain.
  const denied = new Set(['browser_run_code']);
  const runners = new Set(['test_run', 'test_debug', 'test_list', 'planner_setup_page', 'generator_setup_page']);
  const allowedOrigins = new Set(ports.map(port => `http://127.0.0.1:${port}`));
  return function policyViolation(message) {
    if (message?.method !== 'tools/call') return null;
    const { name, arguments: input = {} } = message.params ?? {};
    if (denied.has(name)) return `${name} is disabled for Sawaa Playwright agents`;
    if (runners.has(name)) {
      const pending = unreviewed();
      if (pending.length) return `${name}: review and commit test code before running it (${pending.join(', ')})`;
    }
    // Writer tools need a path; other tools may take optional paths they read
    // (seedFile, upload paths) or write (screenshot, evaluate output).
    const paths = Object.entries(input).filter(([key]) => /^(file_?name|seed_?file)$/i.test(key))
      .concat(Array.isArray(input.paths) ? input.paths.map(value => ['paths', value]) : []);
    if (writers.has(name) && !paths.some(([key]) => /^file_?name$/i.test(key))) return `${name}: fileName must be a relative path under e2e/playwright/`;
    if (input.paths !== undefined && !Array.isArray(input.paths)) return `${name}: paths must be a list of paths under e2e/playwright/`;
    for (const [key, value] of paths) {
      if (value === undefined && !writers.has(name)) continue;
      // Playwright's writer rewrites '\\' to '/' after this check would run, so refuse it.
      if (typeof value !== 'string' || isAbsolute(value) || /[\\\0]/.test(value)) return `${name}: ${key} must be a relative path under e2e/playwright/`;
      const target = resolve(root, value);
      const inside = relative(testRoot, target);
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
