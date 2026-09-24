# Related-project issue tracker survey

Phase 0 research task: a scan of five projects that share Cadre's threat model —
software where the data at rest can get someone hurt if it leaks or lingers. The
goal isn't feature parity with any of them; it's to see which problems keep
recurring across independently-built projects, since a problem five teams hit is
a problem Cadre should design against up front rather than discover later.

Every link below was checked with `gh api repos/<owner>/<repo>/issues/<n>` to
confirm it resolves to a real, existing issue.

## CryptPad (cryptpad/cryptpad)

End-to-end encrypted collaborative office suite with its own "Teams" and
contact/access-list model — the closest analogue here to Cadre's member ledger.

1. **Access revocation doesn't fully revoke.** Removing someone from a shared
   drive or team doesn't reliably cut off access to everything they'd already
   seen.
   - [Access List does not revoke access to users who saved file from Team Drive (#1972)](https://github.com/cryptpad/cryptpad/issues/1972)
   - [Documents shared as read-only revert to editable when the owner edits them (#2054)](https://github.com/cryptpad/cryptpad/issues/2054)
2. **Deleted membership data lingers in the UI/state after removal.** The
   record is gone from the source of truth but stale copies survive elsewhere.
   - [Profile picture remains shown in team roster after deletion (#2043)](https://github.com/cryptpad/cryptpad/issues/2043)
   - [Team rosters create unnecessary checkpoints and slow down account loading (#1613)](https://github.com/cryptpad/cryptpad/issues/1613)
3. **Account deletion and full-data export are long-standing, unresolved asks.**
   Both go directly to "can a user get their data out, and can it actually be
   made to disappear."
   - [GDPR compliance (#252)](https://github.com/cryptpad/cryptpad/issues/252)
   - [Feature request: Export all data (#251)](https://github.com/cryptpad/cryptpad/issues/251)
4. **No lifecycle for accounts nobody uses anymore.** Cadre's `expires_at` /
   retention model is exactly the kind of thing this issue is asking for.
   - [Remove inactive users (#200)](https://github.com/cryptpad/cryptpad/issues/200)
5. **Contacts/roster UX is a recurring pain point**, independent of the crypto
   underneath — scrolling, missing links, general usability.
   - [Contacts page is not scrollable (#2317)](https://github.com/cryptpad/cryptpad/issues/2317)
   - [Contact application improvement (#1355)](https://github.com/cryptpad/cryptpad/issues/1355)

## SecureDrop (freedomofpress/securedrop)

Whistleblower submission platform. No member ledger, but sources and
journalists are exactly the kind of "this list getting out gets someone hurt"
data Cadre is built for, and deletion is a first-class concern there too.

1. **"Delete" leaves dangling references instead of clean removal.** Deleting a
   source or its submissions doesn't fully clean up related state, and hitting
   the leftover state throws errors instead of behaving as if it's gone.
   - [Reloading URL to deleted source causes internal server error (#5147)](https://github.com/freedomofpress/securedrop/issues/5147)
   - [Stale event responses can reintroduce sources omitted from the API v2 index (#7884)](https://github.com/freedomofpress/securedrop/issues/7884)
2. **Soft delete vs. real delete is an open design question**, unresolved for
   years — precisely the distinction Cadre's crypto-shred rule is meant to
   force a decision on rather than leave ambiguous.
   - [Implement soft delete (disable) of journalist accounts (#3926)](https://github.com/freedomofpress/securedrop/issues/3926)
   - [Consider adding an option to delete inactive sources (#7096)](https://github.com/freedomofpress/securedrop/issues/7096)
3. **Key deletion is treated as a distinct, harder problem than record
   deletion** — deleting the row isn't enough if the key that protected it is
   still around.
   - [Securely delete GPG keys (#3593)](https://github.com/freedomofpress/securedrop/issues/3593)
4. **Minimizing incidentally-collected metadata.** Explicit recognition that
   metadata retained "for convenience" (filenames, timing) is itself a
   liability, not a neutral byproduct.
   - [Record file attachment names separately from file itself (#7650)](https://github.com/freedomofpress/securedrop/issues/7650)
   - [Update existing source reply keys to prevent leaking timing information (#3995)](https://github.com/freedomofpress/securedrop/issues/3995)
5. **Operational logs need their own retention policy**, separate from
   application data — logs are an easy place for PII to leak out the side door.
   - [Set worker log retention to 30 days (#4817)](https://github.com/freedomofpress/securedrop/issues/4817)

## OnionShare (onionshare/onionshare)

Ephemeral file/chat/site sharing over Tor. No persistent member list, but its
issues surface the tension between "keep no state" (its whole threat model) and
users wanting history/persistence anyway — a tension Cadre resolves
differently (it does keep state) but needs to be deliberate about.

1. **Users want history/persistence that the tool deliberately doesn't keep**,
   and the absence of it is treated as a UX bug by users even though it's a
   security property by design.
   - [Fragmented Upload/Download History (#1720)](https://github.com/onionshare/onionshare/issues/1720)
   - [Lack of Anonymous Chat History (#1714)](https://github.com/onionshare/onionshare/issues/1714)
2. **Files carry hidden identifying metadata the sharer didn't know about.**
   Directly relevant to Cadre's "don't leak PII sideways" rule — the leak
   vector here isn't the transport, it's the payload.
   - [Warn about and/or remove identifying exif metadata (#1429)](https://github.com/onionshare/onionshare/issues/1429)
3. **Persistent addresses/settings are requested but resisted** because
   persistence itself is a deanonymization risk in their model.
   - [Enhancement - Maintain persistent fileshare address after adding files (#1338)](https://github.com/onionshare/onionshare/issues/1338)
   - [Feature request: "Portable" settings (#366)](https://github.com/onionshare/onionshare/issues/366)

## Signal Desktop (signalapp/Signal-Desktop)

E2E-encrypted messenger with contacts and groups. Multi-device sync surfaces a
class of bug that's a direct warning for any local-first design: state that
should be deleted or absent keeps reappearing because a second copy exists
somewhere the deletion logic doesn't reach.

1. **Deletion doesn't propagate to every copy of the data.** This is the same
   failure mode AGENTS.md rule 2 exists to prevent, just multi-device instead
   of multi-store.
   - [Blocked and deleted chat keeps reappearing (#7070)](https://github.com/signalapp/Signal-Desktop/issues/7070)
   - [Deleting a note to myself on all devices does no longer delete it everywhere (#6527)](https://github.com/signalapp/Signal-Desktop/issues/6527)
2. **Contact/roster state drifts and shows entries that shouldn't exist
   anymore** — phantom or stale members surviving past when they should have
   been removed.
   - [I can see strangers in my contacts (#6217)](https://github.com/signalapp/Signal-Desktop/issues/6217)
   - [Desktop shows contacts not on phone, can't delete them (#6660)](https://github.com/signalapp/Signal-Desktop/issues/6660)
3. **Group membership counts/records don't stay consistent**, i.e. the roster
   itself becomes an unreliable source of truth.
   - [Inconsistent group member count (#5235)](https://github.com/signalapp/Signal-Desktop/issues/5235)
   - [Random extra member in new group chat that only appears on desktop (#2422)](https://github.com/signalapp/Signal-Desktop/issues/2422)
4. **Export is a recurring failure point**, not a one-off — several distinct
   export bugs across versions.
   - [Couldn't export chat history (#7959)](https://github.com/signalapp/Signal-Desktop/issues/7959)
   - [Cannot export messages from unlinked device (#7927)](https://github.com/signalapp/Signal-Desktop/issues/7927)

## Guardian Project

Most of the org's ~40 repos are dormant or formally archived (e.g.
`ChatSecureAndroid`, last pushed 2018, archived). `orbot` is actively
maintained but is a Tor proxy with no member/contact data model, so its
tracker had nothing on-theme. `haven` (remote safety/intrusion-monitoring app)
is the closest fit — not archived, but effectively stalled since 2022 (see
issue #465, an open call asking whether anyone is still maintaining it, and
#460, an open call for new leadership). Themes below are drawn from `haven`
with that caveat: this is a smaller, more tentative signal than the other four
projects.

1. **Deleting locally-stored sensitive data (event logs, in this case) doesn't
   reliably work**, including a platform-specific case where it silently
   fails.
   - [User can't delete old events (#333)](https://github.com/guardianproject/haven/issues/333)
   - [Logs cannot be deleted in Android 7 (#354)](https://github.com/guardianproject/haven/issues/354)
2. **Whether to gate access to sensitive local data behind a PIN/passphrase is
   an open, unresolved design question** rather than a settled default.
   - [Is an app lock PIN / passphrase necessary? (#25)](https://github.com/guardianproject/haven/issues/25)
3. **Users want control over where sensitive data physically lives**, not just
   whether it's encrypted.
   - [Allow users to set storage location (#276)](https://github.com/guardianproject/haven/issues/276)

## Cross-project themes

Themes that show up in more than one tracker, independent of each project's
specific domain:

- **Deletion that doesn't fully propagate.** CryptPad (#1972, #2043),
  SecureDrop (#5147, #7884), Signal Desktop (#7070, #6527), and Haven (#333,
  #354) all have open issues where "delete" leaves a stale copy somewhere else
  in the system — a second store, a second device, a cached UI element, a
  platform quirk. This is the single most common failure mode across all four
  projects that keep any persistent state at all, and it's exactly what
  AGENTS.md rule 2 ("don't keep what you can't protect") and the crypto-shred
  invariant are meant to make structurally impossible rather than
  policy-enforced.
- **Soft delete vs. real delete is treated as an open question, not a solved
  one.** SecureDrop (#3926) and CryptPad (#251/#252, account deletion/export)
  both have long-unresolved issues asking for a real answer here. Cadre
  already has an answer (crypto-shred, no soft-delete-that-leaves-the-key),
  which is worth stating plainly in onboarding docs as a differentiator, since
  it's evidently not obvious or default elsewhere.
- **Roster/membership state drifts from reality.** CryptPad's team rosters
  (#2043), Signal's group member counts (#5235, #2422) and contact lists
  (#6217, #6660) all show the same shape of bug: the membership list itself
  becomes unreliable over time, independent of encryption. This argues for
  the repository contract tests treating "the roster matches who actually has
  access" as a correctness property to test directly, not just an emergent
  side effect of the CRUD operations.
- **Metadata retained "for convenience" becomes its own leak vector.**
  SecureDrop's filename/timing metadata (#7650, #3995) and OnionShare's EXIF
  data (#1429) are the same lesson from different domains: data nobody
  intentionally decided to keep sensitive is still sensitive.
- **Export and full-data-portability requests are old, and often unresolved
  after years.** CryptPad (#251, open since early project history) and Signal
  Desktop (#7959, #7927, recurring across versions) both show that reliable
  export is harder in practice than it looks, and users expect it as a right,
  not a nice-to-have. Relevant to Cadre's "exports are encrypted by default"
  invariant — the encryption default and export reliability are separate
  engineering problems and both need to hold.

## Candidate upstream contributions for Phase 6

Small, concrete, and inside what an outside contributor could plausibly land
without deep context on any of these codebases:

- **SecureDrop** — [#7650, record file attachment names separately from the
  file itself](https://github.com/freedomofpress/securedrop/issues/7650) is a
  metadata-minimization fix in the same spirit as Cadre's sensitive-fields
  discipline; likely scoped enough for a doc-adjacent or small backend PR.
- **CryptPad** — [#200, remove inactive users](https://github.com/cryptpad/cryptpad/issues/200)
  is labeled "Help wanted" and is a retention/lifecycle feature Cadre will
  have already built a version of for its own `expires_at` handling; a
  natural place to contribute the pattern back.
- **OnionShare** — [#1429, warn about/remove identifying EXIF metadata](https://github.com/onionshare/onionshare/issues/1429)
  is a bounded, well-specified metadata-stripping feature.
- **Haven** — docs-only contribution: the project is asking in the open
  ([#465](https://github.com/guardianproject/haven/issues/465),
  [#460](https://github.com/guardianproject/haven/issues/460)) whether anyone
  is maintaining it; not a code contribution candidate right now, but worth
  revisiting later in case the project's fate changes before Phase 6.
