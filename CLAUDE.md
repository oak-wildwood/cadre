@AGENTS.md

Claude-specific:

- Use plan mode before any multi-file change. Reject a plan that touches more than the issue's
  scope.
- When an issue says "decision record required", write `docs/decisions/NNNN-<slug>.md` in the
  same PR using the template in `docs/decisions/README.md`.
- If a task would require `tofu apply`, `helm install` against a non-local cluster, or any paid
  service, stop and say so in the issue instead of proceeding.
- Before running `gh pr create`, count the title. `pr-title.yml` requires 66 characters or fewer
  (see AGENTS.md) and blocks the merge otherwise — check it yourself rather than relying on CI to
  catch it, since a failing check can still be bypassed and merged by an admin.
- Every `git commit` needs `-s` (see AGENTS.md). After committing, actually run `gh pr create`
  rather than leaving a "Create PR" link and marking the task done anyway — a run on 2026-09-17
  did exactly that, self-reported the checklist item as complete, and left the PR unopened.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`oak-wildwood/cadre`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: root `CONTEXT.md` (created lazily) plus decision records in `docs/decisions/` — see `docs/decisions/README.md` for the template and when to write one, and `docs/agents/domain.md` for how skills should consume them.
