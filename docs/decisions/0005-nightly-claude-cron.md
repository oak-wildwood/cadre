# 0005 — Nightly unattended Claude cron

**Status:** accepted
**Date:** 2026-09-20

## Decision

`.github/workflows/claude-nightly.yml` runs on a daily schedule (`0 9 * * *` UTC, plus
`workflow_dispatch` for manual runs). Each run claims the single oldest open issue labeled
`claude-task` (labeling it `claude-in-progress` for the run's duration so the next night can't
grab it too), runs Claude Code against it via the same GitHub App and
`CLAUDE_CODE_OAUTH_TOKEN` secret `claude.yml` already uses, and always opens a pull request for
human review rather than merging anything itself. It is explicitly instructed never to modify
anything under `.github/workflows/`, and its `--allowedTools` grant is scoped to this project's
actual `npm` scripts (`ci`, `install`, `build`, `test`, `lint`, `typecheck`) plus
`gh pr create`/`gh pr view`, not a bare `npm` grant — so it can verify its own work before
opening a PR but has no wider shell access than that. The two labels (`claude-task`,
`claude-in-progress`) queue and track work; nothing merges without the same PR review any other
change gets.

## Why, and what threat it addresses

An unattended agent with a repo-scoped token and shell access is itself the kind of thing this
project's threat model asks to be suspicious of — it's additional attack surface and an insider-
access-shaped risk if the token or the workflow were ever compromised. Three things keep the
blast radius bounded: it can only act on issues a human deliberately labeled `claude-task`, it
never merges (a human still reviews and merges every PR it opens, same as any contributor's), and
its tool grant is narrowed to build/test/lint commands rather than an unscoped shell. None of
this touches PII or the storage layer directly — it edits application code and opens PRs like a
human contributor would — so it doesn't trigger the crypto-shredding or retention rows of the
threat model, only the general "minimize what any credentialed actor can do" instinct behind
rule 2 and the "Compromised server" / "Insider / careless member" rows in the README's threat
model summary.

## Alternatives considered

- **No unattended cron** — status quo; every task needs a human to type `@claude`. Simpler and
  zero added surface, but loses the ability to queue overnight work, which is the whole point of
  this issue.
- **A bare `Bash(npm:*)` grant** (as the `gh-repo-init` template ships by default) — rejected;
  wider than this project needs, since the actual verification surface is five known scripts in
  `package.json`, not arbitrary npm subcommands.
- **Let the nightly run auto-merge on green CI** — rejected; removes the human gate this project
  relies on for every other change, and this repo has no branch protection ruleset requiring
  review in the first place, so auto-merge here would be strictly weaker than the human-triggered
  path.
- **Broaden the schedule to multiple times a day** — rejected; nightly is enough for a queued-work
  model and keeps runs (and token use) infrequent and easy to audit.

## Consequences

`CLAUDE_CODE_OAUTH_TOKEN` must stay set as a repository secret (already required by `claude.yml`)
or the nightly job fails outright — a failure it reports on the issue rather than silently
retrying forever. Labeling an issue `claude-task` is now a meaningful, security-relevant action:
anyone with issue-label permission can queue unattended code changes, so label permissions are
part of this repo's trust boundary going forward. A run that finds no `claude-task` issue is a
cheap no-op. Because the workflow forbids the agent from touching `.github/workflows/` itself,
changing the cron's schedule, tool grants, or labels always requires a human-authored PR, not a
nightly run editing its own permissions.
