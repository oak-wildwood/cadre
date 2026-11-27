# Demo: a reporter's roster

A made-up local investigative reporter's contacts, so you can try Cadre's Phase 1 core with data
that is safe to look at. It is **local only**: the loader exists only under `npm run dev` and is
left out of every production build (record 0004; `src/demo/buildIsolation.spec.ts` checks it).

Everything in it is invented. Emails end in `@example.invalid`, phones are `+1-555-01xx`, names are
made up, and `src/demo/roster.spec.ts` checks every value. The roster is written through
`LedgerRepository`, so each sensitive field is encrypted like any other member's.

## What is in it

Twelve people across three cases (Harbor Lights zoning, Ward 4 ballot, Mill Street fire). **Role**
is `source`, `suspect`, `ally` (editor, lawyer, fixer) or `subject`. Cases are not records: a
person's notes start with `Case: <name>`, and anyone in a second case has an `Also in: <name>`
line. A real cases table would need a migration, a sensitivity classification and a decision
record, so it is left for later. Two people expire a minute after you load the roster, one has no
expiry set and takes the org default, and the rest have an explicit expiry.

## Walkthrough

1. `npm ci && npm run dev`, then open `/app.html` on the printed URL (for example
   `http://localhost:5173/app.html`; the root is only the landing page). In a fresh browser
   profile, choose a passphrase (15+ characters) to create the store. On the empty member list, choose **Load demo roster**.
   It is offered only while the store is empty and refuses otherwise. You should see 12 people.
2. Search for `wren.ashgrove@example.invalid` or `Wren Ashgrove`: one match. Search `Wren`: no
   exact match. Search is equality-only on name and email.
3. Open Wren Ashgrove (a confidential source), edit the notes, save.
4. Wait a minute, then **Lock** and unlock again. Unlocking purges expired records, so you see
   "Purged 2 expired records". (The background timer runs hourly.)
5. Settings → Export with a passphrase, Lock, open a second fresh profile, create a store, and
   import the file. The same roster appears, minus anything that expired.
6. DevTools → Application → IndexedDB → `/pglite/cadre`: only ciphertext and HMACs, no names.

Not built: masking phone and email until revealed (listed in `docs/dev.md`). The confidential
source is marked in the notes only.
