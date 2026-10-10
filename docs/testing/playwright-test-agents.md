# Playwright Test Agents

The repo-local Codex agents in `.codex/agents/` follow Playwright 1.63's native Codex agent format, adapted from the installed upstream planner, generator and healer templates. The `playwright-test-local` MCP server runs through `scripts/run-playwright.cjs` from `apps/dashboard` so it resolves that app's `@playwright/test` CLI (1.59.1). Tool allowlists match the live 1.59.1 server (including `browser_run_code`). It loads `playwright.local.config.ts`, which fails closed unless `e2e/local/with-env.mjs` supplied the owned synthetic fixture, isolated database and fixed localhost origins.

Start the isolated local stack with `pnpm e2e:local:stack --port-set=premerge`; it prints the owned `.e2e/local-<run-id>` path when ready. Start or reload Codex while that stack is healthy. The MCP launcher selects exactly one healthy owned local run, then passes its recorded fixture environment through the existing `with-env.mjs` guard. The configured test projects are `website` (`127.0.0.1:55205`) and `dashboard` (`127.0.0.1:55203`); tests live in `e2e/playwright/`. The standalone `pnpm test:premerge` command (Node 22.12 or newer, per `.nvmrc`) starts and stops its own local stack and runs the Playwright smoke plus existing booking and staff journeys; it does not keep the stack available for interactive agent exploration.

To list or run tests against a live stack, invoke the app-local Playwright runner under that run's `with-env.mjs` environment:

```sh
node e2e/local/with-env.mjs .e2e/local-<run-id> pnpm --dir apps/dashboard exec node ../../scripts/run-playwright.cjs test --config ../../playwright.local.config.ts --list
```

Use the planner to save a test plan under `e2e/playwright/`, the generator to create a deterministic spec there, and the healer only to diagnose an actual failure. The agents are pinned to `gpt-6-luna` with medium reasoning effort. Their TOML files configure future agent sessions; reload Codex to activate the updated agent and MCP configuration. A file setting does not change the model of an already-running session.

All test data must remain synthetic and local. Do not use staging, production, external targets, shared databases, migrations or destructive cleanup. Keep failures visible: skips, `test.fixme`, conditional skips and weaker assertions are prohibited. Agents may edit tests and their documentation only, never application behavior, auth, payments, encryption or production settings. No paid provider or model fallback is allowed.

The `premerge` port set uses dedicated infrastructure ports 55771/55772/55773 and prepares the first Next dev page compilations before browser tests. Default local-stack ports remain available.

The MCP launcher (`e2e/playwright/run-mcp.mjs`) rejects any tool file path (plans, tests, screenshots, evaluate output) outside `e2e/playwright/` and `browser_navigate` targets outside the three loopback origins. `playwright.local.config.ts` also routes every browser request except the three app origins to a closed proxy port, so page scripts, clicked links, other local services and literal IPs are blocked too.
