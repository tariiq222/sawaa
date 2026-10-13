---
name: jev-review
description: Run Jev Review as a repeated scalar feedback loop during nontrivial coding work. Establish a score baseline after a coherent implementation, diagnose weak dimensions yourself, improve the code, validate it, and rescore with the previous evaluation until important metrics improve or no further justified change remains.
---

# Jev Review

This is the canonical project skill in `.agents/skills/jev-review`; `.claude/skills/jev-review` links here so Codex and Claude Code use the same instructions.

The project registers the `jev-review` MCP server in `.mcp.json` for Claude Code and `.codex/config.toml` for Codex. Its tool is `jev_review` (Claude Code exposes `mcp__jev-review__jev_review`). Both clients launch `scripts/mcp/jev-review.cjs` with the installed Node runtime.

The launcher reads `JEV_API_KEY` from its environment, or falls back to the private `~/.config/jev-review/api-key` file (directory mode `700`, file mode `600`). Keep the key outside Git; never copy it into either MCP configuration or this skill. It starts the existing bundle at `~/code/jev-review/dist/server.js`. `JEV_API_KEY_FILE` and `JEV_REVIEW_SERVER` can override those paths for another local installation. This does not depend on OpenCode configuration.

After changing MCP settings, restart the client's MCP connection or open a new session and confirm `jev_review` is listed. On another machine, install/build Jev Review and adjust the local Node/launcher paths in both configurations. A missing key, missing bundle, authentication failure, or unavailable service is a blocker to Jev evaluation; report it without substituting another provider.

Jev sends only the supplied evaluation context to `https://api.typesafe.ai/v1/systemone`. Use focused, sanitized context. Jev is an explicitly requested evaluation service; implementation, diagnosis, and final decisions stay with the owner's approved GPT-6.1 Sol agents. Apply the project's selective workflow: simple questions, inspections, prose edits, and small configuration changes do not require a scoring loop. Never retry exhausted quota; allow at most one bounded retry for a transient failure.

Use `jev_review` as an iterative engineering-quality signal, not as a narrative code reviewer. The coding agent owns diagnosis, implementation, testing, and final judgment. Jev evaluates the supplied state and returns structured scores; it never edits files.

## The operating model

The loop is:

```text
implement → validate → score → inspect → form a hypothesis → improve → validate → rescore
```

A first evaluation is a baseline, not the end of the review. For a nontrivial task, continue the loop after meaningful changes and use score movement to test whether the implementation actually improved.

Jev does not generate a prose explanation of why a score is low. Treat these as the primary signals:

- Per-metric score
- Confidence
- Change from the previous evaluation
- Meaningful improvements and regressions

Any summaries, priority reasons, or issue labels in the tool response are predefined rubric/category hints. They are not a root-cause analysis from Jev and may not identify the exact problematic code. Inspect the implementation and requirements yourself to determine why a dimension is weak.

## Required review loop

For substantial coding work where Jev evaluation is applicable under the project's selective workflow:

1. Understand the user's requirements, invariants, and repository conventions.
2. Implement a coherent slice and run the relevant tests or checks.
3. Call `jev_review` to establish or refresh the baseline.
4. Identify the weakest important metrics, prioritizing correctness, cognitive complexity, changeability, coupling, modularity, abstraction quality, tests, reliability, and security.
5. Inspect the code and form a concrete hypothesis for what is lowering one or more scores.
6. Make the smallest justified improvement that addresses that hypothesis. Do not ask Jev to write or explain the fix.
7. Run relevant validation again.
8. Call `jev_review` again with the updated implementation and the prior response in `previousEvaluation`.
9. Check whether targeted scores improved and whether any other dimension regressed.
10. Repeat when an important weak metric remains and another evidence-based improvement is available.

Do not stop merely because `jev_review` was called once. When a targeted score does not improve, reconsider the diagnosis instead of making random cosmetic changes. Try a different justified improvement and rescore, or determine from the code, confidence, and requirements that the metric should not drive another change.

## When to call

Call `jev_review`:

- After the first coherent implementation exists
- After each meaningful implementation slice
- After each review-driven improvement
- After changes to control flow, state, dependencies, public contracts, tests, or security-sensitive behavior
- Before final handoff when the previous evaluation no longer describes the current code

Interim reviews may precede the full test suite, but the final evaluation should follow the project's normal validation. Do not call on an unchanged implementation, formatting-only noise, or context too thin to judge.

## Keep comparisons useful

Use `task` and the current `diff` in most calls. Add full files only when surrounding behavior is necessary. Use `repositoryContext` for relevant architecture, conventions, invariants, and test results.

On a follow-up call:

- Pass the previous tool response unchanged as `previousEvaluation`.
- Send the current implementation state, not the obsolete pre-fix diff.
- Keep the task and context scope reasonably consistent so score deltas remain comparable.
- Include newly relevant tests, callers, or contracts when they affect the judgment.

Example:

```json
{
  "task": "The requested behavior and acceptance constraints",
  "diff": "The current implementation diff after the latest changes",
  "files": [
    {
      "path": "src/example.ts",
      "content": "Only include surrounding code needed to judge the change"
    }
  ],
  "repositoryContext": "Relevant conventions, invariants, and validation results",
  "previousEvaluation": {}
}
```

If Jev reports that its input limit was exceeded, remove unrelated content or split the implementation into coherent review slices. Do not blindly truncate contracts, callers, or tests needed to judge the change.

Never send secrets, credentials, private keys, environment files, generated output, vendored code, or unrelated repository content.

## Stopping conditions

Stop the loop when:

- The implementation satisfies the user's requirements and normal validation passes.
- Important targeted metrics improved and no meaningful regression was introduced.
- Remaining weak or low-confidence metrics have no concrete, justified improvement available.
- Further score-seeking changes would add scope, complexity, coupling, or behavioral risk.

Scores are evidence, not objectives to game. Never improve a score by adding speculative architecture, unnecessary abstraction, meaningless tests or comments, mechanical file splitting, scope expansion, or behavior changes the user did not request. Correctness and the user's actual requirements always come first.
