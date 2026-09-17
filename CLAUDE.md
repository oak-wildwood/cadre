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
