import { isAbsolute, relative, resolve } from 'node:path';

// Playwright's writer tools only check paths against the workspace root, and
// browser_navigate accepts any URL, so the MCP launcher enforces the agent
// boundary: writes stay under e2e/playwright/, navigation stays on loopback.
export function createMcpPolicy(root, ports) {
  const testRoot = resolve(root, 'e2e/playwright');
  const allowedOrigins = new Set(ports.map(port => `http://127.0.0.1:${port}`));
  return function policyViolation(message) {
    if (message?.method !== 'tools/call') return null;
    const { name, arguments: input = {} } = message.params ?? {};
    if (name === 'planner_save_plan' || name === 'generator_write_test') {
      const fileName = input.fileName;
      if (typeof fileName !== 'string' || isAbsolute(fileName)) return `${name}: fileName must be a relative path under e2e/playwright/`;
      const inside = relative(testRoot, resolve(root, fileName));
      if (!inside || inside.startsWith('..') || isAbsolute(inside)) return `${name}: fileName must be under e2e/playwright/`;
    }
    if (name === 'browser_navigate') {
      let origin = null;
      try { origin = new URL(input.url).origin; } catch {}
      if (!allowedOrigins.has(origin)) return `browser_navigate: only ${[...allowedOrigins].join(', ')} are allowed`;
    }
    return null;
  };
}
