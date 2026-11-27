# Demo: a historian's research roster

Sixteen well-known radicals, dissidents and their adversaries, so you can try Cadre's Phase 1 core with data that is
safe to look at. It is **local only**: the loader exists only under `npm run dev` and is left out
of every production build (record 0004; `src/demo/buildIsolation.spec.ts` checks it).

Only people who have died are in it, and no living person may be added; every entry records a year of death and the test requires it. Contact details are fake:
emails are `demoNN@example.invalid` placeholders, not guesses at real addresses, and phones are `+1-555-01xx`, and `src/demo/roster.spec.ts` checks
every value. Notes are short public-record facts. The roster is written through
`LedgerRepository`, so each sensitive field is encrypted like any other member's.

## What is in it

Sixteen people across six cases, each a research project (Abolition, Black Panther Party, Pan-African
radicalism, Socialist internationalism, Cuban Revolution, Fascism): John Brown, Nat Turner, Fred Hampton,
Huey Newton, George Jackson, Kwame Ture, Malcolm X, Walter Rodney, Rosa Luxemburg, Che Guevara,
Fidel Castro and Haydée Santamaría, plus four adversaries: J. Edgar Hoover, Fulgencio Batista,
Waldemar Pabst and Heinrich Himmler. **Role** is `organizer`, `theorist`, `leader`, `writer` or
`adversary`.
Cases are not records: a person's notes start with `Case: <name>`, and anyone in a second
case has an `Also in: <name>` line. A real cases table would need a migration, a
sensitivity classification and a decision record, so it is left for later. Two people expire a
minute after you load the roster, one has no expiry set and takes the org default, and the rest
have an explicit expiry.

## Walkthrough

1. `npm ci && npm run dev`, open the printed URL. In a fresh browser profile, choose a passphrase
   (15+ characters) to create the store. On the empty member list, choose **Load demo roster**.
   It is offered only while the store is empty and refuses otherwise. You should see 16 people.
2. Search for `demo01@example.invalid` or `John Brown`: one match. Search `John`: no
   exact match. Search is equality-only on name and email.
3. Open John Brown, edit the notes, save.
4. Wait a minute, then **Lock** and unlock again. Unlocking purges expired records, so you see
   "Purged 2 expired records". (The background timer runs hourly.)
5. Settings → Export with a passphrase, Lock, open a second fresh profile, create a store, and
   import the file. The same roster appears, minus anything that expired.
6. DevTools → Application → IndexedDB → `/pglite/cadre`: only ciphertext and HMACs, no names.

Not built: masking phone and email until revealed (listed in `docs/dev.md`).
