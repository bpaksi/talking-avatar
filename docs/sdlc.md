# Development process (SDLC)

A lean, solo, AI-native loop. Bob is product owner and tech lead; cloud coding agents build; reviewer agents attack every PR; merging is automatic once checks pass.

## The loop

```text
plan (plans/Px-plan.md) --Bob approves--> steps --> one branch + one PR per step
   --> CI `check` + verifier + two adversarial reviewers (<= 3 fix rounds)
   --> squash auto-merge  (or `needs-bob` label on round-3 failure)
```

1. **Plan first.** Each milestone has a plan in `plans/`. No code is written for a milestone until Bob has approved its plan (gate `G0`). Deviations from the plan update the plan in the same PR.
2. **One branch, one PR per step.** Branch names: `<type>/<slug>` (e.g. `feat/tts-cache`). Commits use Conventional Commits. Nobody commits to `main` directly.
3. **Built by cloud coding agents.** One agent per plan step, each in its own clone/branch. The agent runs `pnpm check` and puts the result (exit code, test counts, what was not verified) in the PR body together with the plan step id.
4. **Review on every PR:**
   - **Verifier** — runs the checks, tests and any render/screenshot steps on the PR branch and posts results. It reports; it never fixes.
   - **Adversary (bugs)** — bugs, edge cases, races, security and privacy, weak tests.
   - **Adversary (spec)** — checks the PR against the plan step’s acceptance criteria and looks for regressions.
   - The two adversaries run on **different models**, so they do not share blind spots. Each report ends with `Blocking: none` or `Blocking: <count>`.
5. **Fix rounds: at most 3.** The building agent fixes blocking findings, pushes, and answers each finding on the PR. If blocking findings remain after round 3, the PR gets the `needs-bob` label, auto-merge is disabled, and dependent steps wait. Bob decides: fix, re-scope, override, or drop.
6. **Merge.** Squash auto-merge once CI `check` is green and the latest reports from **both** adversaries say `Blocking: none`. PRs merge one at a time; a stale branch is updated and re-checked first. **Bob never merges by hand.**

## Tests and CI come first

Step 1 of any milestone sets up tests and the CI `check` workflow. No PR auto-merges before that exists. Branch protection on `main` requires the `check` status and an up-to-date branch.

## Steps in a plan

Each step lists:

```markdown
### S3: <title>
- Depends on: S2           # step or gate ids, or "none"
- Touches: packages/cli/src/tts/**
- Acceptance: <testable criteria>
```

Steps whose dependencies are merged and whose `Touches` do not overlap may run in parallel; merging stays serial. At most one parallel step may change `package.json` / `pnpm-lock.yaml`.

## Stack conventions

- **pnpm** workspace; dependencies pinned to **exact versions** (no `^` / `~`).
- **Biome** for format and lint.
- **Vitest** for tests.
- `pnpm check` = lint + typecheck + tests; the same command runs in CI.
- Secrets live in environment variables, never in the repo.

## Human gates

Bob signs off only at named gates (plan approval, and any step needing human judgement, e.g. "does the lip sync look right"). Each gate is a step in the plan; nothing after it starts until Bob records sign-off in the plan or the PR.

## Metrics worth a glance

- First-pass CI success per PR.
- Blocking findings and rounds used per merged PR; recurring ones become documented known mistakes.
- `needs-bob` escalations per milestone (more than one suggests steps are too big).
