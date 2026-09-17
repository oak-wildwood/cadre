# Contributing

Read [AGENTS.md](AGENTS.md) first — it has the hard rules and invariants that apply to every
change, human- or agent-authored.

## Sign off your commits (DCO)

Cadre uses the [Developer Certificate of Origin](https://developercertificate.org/) instead of
a CLA. There's no paperwork: every commit just needs a `Signed-off-by` trailer certifying you
wrote it or otherwise have the right to submit it under the project's license
([AGPL-3.0](LICENSE)).

Add the trailer with `-s`:

```
git commit -s -m "fix: stop purgeExpired skipping rows with a null org default"
```

which appends:

```
Signed-off-by: Your Name <your.email@example.com>
```

Use your real name and a working email — this is a legal attestation, not a handle. If you
forgot to sign off a commit, `git commit --amend -s` fixes the most recent one.

## Pull requests

See [AGENTS.md](AGENTS.md#pr-titles-become-commit-messages) for PR title conventions — this
repo squash-merges, and the PR title becomes the permanent commit message.
