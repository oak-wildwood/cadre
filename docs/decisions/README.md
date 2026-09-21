# Decision records

One file per architectural choice, numbered in order: `NNNN-short-slug.md`. Short is the
point — most decisions fit in a paragraph.

## When to write one

Only when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will look at the code and wonder "why on
   earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and one was picked for
   specific reasons.

If a decision is easy to reverse, skip it: you'll just reverse it. If it's not surprising,
nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we
did the obvious thing."

## Template

```markdown
# NNNN — Title

{1-3 sentences: what's the context, what we decided, and why — tie the why back to a row of
`docs/threat-model.md` where the decision is threat-driven.}
```

That's it for most decisions. Add these only when they add genuine value:

- **Status** frontmatter (`proposed | accepted | superseded by NNNN`) — useful when a decision
  gets revisited.
- **Alternatives considered** — only when the rejected alternatives are worth remembering.
- **Consequences** — only when non-obvious downstream effects need calling out.
