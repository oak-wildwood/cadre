# Threat model

**Status:** draft for Phase 0 (issue #4). Revisit at the end of every phase and whenever a
practitioner conversation changes our picture of who uses Cadre and why.

Cadre stores member lists for small organizations whose members can be evicted, fired, deported
or arrested if the list leaks. This document says what we protect, from whom, how, and where
the protection stops. Every decision record in `docs/decisions/` that is driven by security
should name the row here that it answers.

The structure borrows from prior art in `docs/research/`: EFF's split between assets,
adversaries and capabilities ([eff-surveillance-self-defense.md](research/eff-surveillance-self-defense.md)),
Tactical Tech's *vulnerabilities* column and its point that a threat model is a cycle you
repeat, not a checklist ([tactical-tech-holistic-security.md](research/tactical-tech-holistic-security.md)),
and Access Now's "what do we do once it has already happened" framing
([access-now-digital-security-helpline.md](research/access-now-digital-security-helpline.md)).

## How to read the status labels

Each mitigation is labeled with how real it is today. "Encryption" on its own is not a
mitigation; every row names the mechanism and the phase that delivers it.

| Label | Meaning |
|---|---|
| **Built** | Merged on `main` and covered by tests. |
| **Specified** | An open issue defines the mechanism and its acceptance tests. Not built yet. |
| **Planned** | Named in `docs/roadmap.md` for a later phase. The details are still open. |

At the time of writing, **no cryptographic protection is built yet.** Phase 1 has the
repository interface, its contract tests and the schema. Field encryption (#11), blind indexes
(#12), retention (#13) and the export bundle (#14) are specified.

## 1. Assets

| Asset | Why it matters | Where it lives |
|---|---|---|
| **The roster itself**: the fact that a person is a member | The list of who is affiliated is the target, independent of anything else stored about them. FPF calls this the core of source protection; EFF warns that "who is connected to whom" can reveal more than content ([FPF](research/freedom-of-the-press-foundation.md), [EFF](research/eff-surveillance-self-defense.md)). | One row per member in `members`; the row count and IDs are visible without any key |
| **Member PII**: display name, email, phone, free-text notes | Identifies and locates people. Notes can hold anything (immigration status, health, workplace). | `*_enc` columns; the single list of sensitive fields is `sensitiveFields.ts` (#11; today an interim type in `src/domain/member.ts`) |
| **Roles** | "Organizer," "steward" or "spokesperson" marks who to target first. | `role`, a **plaintext** column (see open question Q1) |
| **Activity timestamps** | `created_at`, `updated_at` and `expires_at` show when an org grew, when it was active and how long it keeps records. | Plaintext columns, needed for sorting and retention |
| **The org's existence** | For some groups, the fact that they use a membership tool, or exist at all, is sensitive. | Wherever Cadre is installed or hosted; Phase 2 server metadata |
| **Keys and passphrases** | Whoever holds them reads everything. | Store passphrase (never persisted), derived subkeys (memory only, #11), export passphrases (#14), Phase 2 key-encryption keys in OpenBao |
| **Export bundles and backups** | A copy that outlives the retention policy defeats the whole design ([FPF](research/freedom-of-the-press-foundation.md)). | Files the operator downloads (#14); anything they copy afterward is outside Cadre's reach |
| **Operator credentials and devices** | The admin's laptop and accounts are the most common real way in ([Access Now](research/access-now-digital-security-helpline.md)). | Outside Cadre; Cadre can only reduce what a compromised device exposes |

## 2. Adversaries

Each row lists the adversary's capability, the likely attack path, what success gets them,
the **vulnerability** on our side that the path exploits, and the mitigations by phase.

### A1. Opportunistic attacker

*Stolen laptop, a leaked or misplaced backup, a phished account.*

- **Likely path:** the attacker gets the browser profile or an export file and reads it offline.
- **Success gets them:** the full roster, which they can sell, publish or hand to someone hostile.
- **Vulnerability:** a weak store passphrase; a bundle left in `Downloads`; a device left unlocked.
- **Mitigations:**
  - Sensitive fields encrypted at rest with AES-256-GCM, a random 96-bit nonce per value and
    the field name as AAD, under a key derived from the passphrase with Argon2id
    (libsodium `crypto_pwhash`). Phase 1, **specified** (#11).
  - Separate subkeys for encryption and blind indexes via `crypto_kdf_derive_from_key`, so one
    key is never used for two jobs. Phase 1, **specified** (#11).
  - Export bundles encrypted under an export passphrase, never plaintext by default, with a
    versioned header. Phase 1, **specified** (#14).
  - Passphrase never persisted; a forgotten passphrase means the data is gone, by design.
    Phase 1, **specified** (#11).

### A2. Legal compulsion

*A subpoena, court order or warrant served on the org, its host or an operator.*

- **Likely path:** a demand to produce the member list or the database. FPF treats this as a
  first-class adversary, not an edge case ([FPF](research/freedom-of-the-press-foundation.md)).
- **Success gets them:** the roster as evidence, or as a lead for further action against members.
- **Vulnerability:** data kept longer than needed; a host that can decrypt; an operator who can
  be compelled to unlock.
- **Mitigations:**
  - Retention as a first-class feature: per-record `expires_at` with an org default, and
    `purgeExpired()` hard-deletes on open and on a timer. Phase 1, **specified** (#13). EFF's
    point applies: the cheapest defense against compelled disclosure is not having the data.
  - The host cannot decrypt end-to-end fields. Phase 1 has no host at all (browser-only);
    Phase 2 keeps sensitive fields encrypted client-side. **Planned**.
  - Crypto-shredding: destroying a data key makes its ciphertext unrecoverable, including in
    backups. Phase 2, **planned** (#37 decides the exact guarantee during migration).
- **Limit:** Cadre cannot protect against an operator who is compelled to unlock it. Duress mode
  (A4) is the only partial answer, and it carries its own legal risk (see residual risk R4).

### A3. Compromised server

*An attacker or a curious host reads the whole server database, its backups or its logs.*
Phase 2 onward; Phase 1 has no server.

- **Likely path:** a stolen `pg_dump`, a misconfigured backup bucket, a hosting employee, an
  application bug.
- **Success gets them:** everything the server can read on its own.
- **Vulnerability:** keys stored next to data; plaintext in logs or error reports; the server
  delivering the web app's code (see R2).
- **Mitigations:**
  - Envelope encryption: data keys wrapped by a key-encryption key held in OpenBao transit,
    which is never co-located with the database. Phase 2, **planned**.
  - Blind indexes (HMAC-SHA256 over normalized values, equality only) so the server can find
    a member without seeing names. Phase 1 mechanism **specified** (#12); server use Phase 2.
  - `pg_dump` shows only ciphertext, enforced by a test. Phase 2, **planned**.
  - No PII in logs, error reports, caches or analytics (AGENTS.md rule 2). All phases;
    enforced by review today, with a test planned for Phase 2.
  - AGPL-3.0, so anyone running a modified hosted Cadre must publish the source
    ([0002-license.md](decisions/0002-license.md)). **Built**. This raises the cost of a quietly
    backdoored host; it does not prevent one.

### A4. Device seizure

*Physical access to an operator's phone or laptop, locked or unlocked, at a border crossing, a
protest or a raid.* Access Now lists device confiscation as a recurring case type, especially
at borders and protests ([Access Now](research/access-now-digital-security-helpline.md)).

- **Likely path:** the device is taken while unlocked, or the operator is compelled to unlock it.
- **Success gets them:** the roster, if Cadre is unlocked or the passphrase can be extracted.
- **Vulnerability:** an unlocked session; an OS lock screen treated as enough. EFF notes a
  device that is only locked, not powered off, is far easier to extract from
  ([EFF](research/eff-surveillance-self-defense.md)).
- **Mitigations:**
  - Passphrase-derived key independent of the OS lock screen. Phase 1, **specified** (#11).
  - `lock()` drops the derived keys from memory, with a Lock button always available.
    Phase 1, **specified** (#11, #15). JavaScript cannot guarantee memory is wiped (see R3).
  - Panic wipe and an optional duress mode. Phase 6, **planned**.
- **Operator guidance (Phase 6 self-hosting guide):** use full-disk encryption, power the device
  off rather than locking it before a crossing or an action, and don't carry the ledger on
  devices that don't need it.

### A5. Insider or careless member

*Someone with legitimate access sees more than they need, or shares it carelessly.*

- **Likely path:** an over-broad role, a screenshot, a forwarded export.
- **Success gets them:** a partial or full roster outside the org's control.
- **Vulnerability:** one shared login; no record of who read what.
- **Mitigations:**
  - Postgres row-level security and least-privilege roles. Phase 2, **planned**.
  - An append-only audit log of reads of PII. Phase 2, **planned**.
  - Phase 1 has a single operator per browser store, so this row mostly applies from Phase 2.

### A6. Departing or hostile admin *(added from research)*

*An admin who leaves the org, sometimes angrily, and keeps what they had.* Tactical Tech calls
onboarding, offboarding and role turnover the moment membership tools are weakest
([Tactical Tech](research/tactical-tech-holistic-security.md)); FPF warns about security
practice that lives in one person's head ([FPF](research/freedom-of-the-press-foundation.md)).

- **Likely path:** they still know the passphrase, still have the browser store, or kept an
  old export.
- **Success gets them:** the roster as of the day they left, for as long as they keep it.
- **Vulnerability:** no way to revoke a passphrase someone already knows; exports Cadre can't
  reach.
- **Mitigations:**
  - Change passphrase, which re-encrypts the store. Phase 1, **specified** as part of #15
    (may be split into a follow-up issue).
  - Revocation and per-user keys on the server. Phase 2, **planned**.
  - A written offboarding checklist (rotate passphrases, re-issue exports, assume old copies
    are compromised). Phase 6 guide, **planned**.
- **Limit:** nothing can make someone forget data they already copied. See R5.

### A7. The org's own stray copies *(added from research)*

*Not an attacker: the org's own workflow puts the roster somewhere the purge logic doesn't
reach.* Every source agrees on this. FPF: a list surviving "in any durable form" undermines
every other precaution. Tactical Tech: shadow spreadsheets and contact lists pasted into
chats are a common real-world failure. The survey of related projects found "delete that
doesn't fully propagate" in four of five trackers
([related-project-issues.md](research/related-project-issues.md)).

- **Likely path:** an export kept as a backup, a spreadsheet made because Cadre was slower, a
  debug log with real data, a deleted record that survives in storage.
- **Success gets them:** nothing by itself. It becomes A1 or A2's way in.
- **Vulnerability:** a legitimate path that is slower than the insecure one; storage that keeps
  deleted bytes (see Q3).
- **Mitigations:**
  - Hard delete, no soft delete, no tombstones with PII. Phase 1, **specified** (#13). The
    delete contract tests already assert that a deleted member is gone from `list()` and
    `findByBlindIndex()`. **Built** (#36, against the in-memory reference repository).
  - Encrypted exports only (#14), so a stray bundle is not a plaintext roster.
  - Make the safe path fast. Search, add and edit have to beat a spreadsheet, or people will use
    the spreadsheet. This is a UI requirement for #15, not a nice-to-have.
  - No PII in logs, fixtures or error reports (AGENTS.md rule 2). **Built** as a rule.

### A8. Impersonated or malicious deployment *(added from research)*

*A fake or tampered copy of Cadre that collects the passphrase.* Access Now's case mix leans
toward phishing and account takeover rather than exotic attacks
([Access Now](research/access-now-digital-security-helpline.md)).

- **Likely path:** a look-alike site or a modified hosted fork that sends the passphrase or
  decrypted data to the attacker.
- **Success gets them:** everything, because the operator unlocks it for them.
- **Vulnerability:** a browser app is only as trustworthy as whoever serves its code (R2).
- **Mitigations:**
  - Self-hosting as the default story, so orgs run code they control. All phases.
  - AGPL-3.0 for hosted forks. **Built**.
  - Signed releases and SBOMs, so an operator can check what they're running. Phase 4,
    **planned**.
  - Guidance on bookmarking the real address and checking release signatures. Phase 6,
    **planned**.

## 3. Out of scope

Cadre is one layer of an org's security, not all of it. These are left out on purpose, and
the README says so.

- **Network-level anonymity.** Cadre does not hide that someone is connecting to it, or from
  where. That is a property of the network path, not the app. Use Tor or a trusted VPN.
- **Malware on the operator's device.** Malware that can read the screen or the browser's
  memory sees whatever the operator sees, and no web app can defend against it. Keep devices
  updated, and get help from a service like the Access Now helpline if you suspect spyware.
- **Traffic and contact-graph analysis outside Cadre.** Who emails whom, who shows up at
  meetings, phone location data. These leak affiliation without ever touching Cadre. Use
  Signal for communication and see EFF's Surveillance Self-Defense guide.

One clarification, from the research: the **roster itself** is a contact graph, and protecting
it is squarely in scope (see Assets). What's out of scope is analysis of activity *around*
Cadre, not the list *inside* it.

## 4. Residual risk

What remains even if everything ships as designed.

- **R1. Membership size and activity are visible.** The number of rows, the timestamps, and
  which records share a blind index (two members with the same email, how often a value
  repeats) are visible to anyone with the database file, even without the key. #12's decision
  record has to state this explicitly.
- **R2. Whoever serves the code can steal the passphrase.** In a browser, the server that
  delivers the JavaScript can deliver a version that sends the passphrase elsewhere. "The host
  cannot decrypt" holds only while the host is honest about the code it serves. Self-hosting,
  signed releases and AGPL reduce this risk; they don't remove it.
- **R3. Keys in memory can't be reliably wiped.** JavaScript has no guaranteed way to zero
  memory. Strings are immutable, and the garbage collector may copy buffers. `lock()` drops
  references, but an attacker with memory access on an unlocked device may still find key
  material.
- **R4. Compelled unlocking.** Encryption doesn't help against an operator forced to unlock.
  Duress mode (Phase 6) can help, but lying to authorities about it can be a crime in some
  jurisdictions, so the guide has to present it carefully.
- **R5. Copies outside Cadre.** Anything already copied (an export, a screenshot, a
  spreadsheet, an ex-admin's memory) is out of reach. Crypto-shredding only reaches
  ciphertext encrypted under keys Cadre controls.
- **R6. A weak passphrase.** Argon2id makes guessing expensive, not impossible. A short or
  reused passphrase can still be cracked offline.

## 5. Assumptions

If any of these is false, the protections above weaken or fail.

1. The operator's passphrase is strong and not reused elsewhere.
2. The browser and OS are not compromised while Cadre is unlocked.
3. The code the browser runs is the code the operator meant to run: self-hosted, or from a host
   they trust (R2).
4. libsodium, WebCrypto and PGlite behave as documented. Cadre composes them and writes no
   primitives of its own (AGENTS.md rule 1).
5. From Phase 2: OpenBao is not co-located with the database, and its unseal keys are held by
   different people than the database admins.
6. The org has some way to get help when something goes wrong: a technically minded member, a
   helpline, a sister org. EFF calls this the "allies" question
   ([EFF](research/eff-surveillance-self-defense.md)).

## 6. When something has already gone wrong

Prevention isn't the whole story; Access Now's whole model starts after the incident
([Access Now](research/access-now-digital-security-helpline.md)). The Phase 6 guide will expand
each of these, but the first moves are:

- **An operator's device is lost or seized:** from another device, change the passphrase if
  the store syncs anywhere (Phase 2+), revoke that user (Phase 2+), and treat any export on
  the device as exposed. Notify affected members if the device may have been unlocked.
- **An admin leaves on bad terms:** rotate every passphrase they knew, re-issue exports under
  new passphrases, and assume their old copies are compromised.
- **An export bundle leaked:** its safety now rests on the export passphrase's strength
  (R6). Decide whether members need to be told.
- **Suspected malware or spyware:** stop using that device for Cadre, and contact a helpline
  (such as Access Now's) before trying to clean it yourself.

## 7. Open questions for Phase 1

The schema and issues as they stand raise these. Each should be settled in the decision record
of the issue named.

- **Q1. Should `role` be a sensitive field?** It's plaintext today so the list can be filtered
  by role. But a role like "organizer" marks who to target first (A2, A4). Options: encrypt it
  and filter client-side after decrypting, or keep it plaintext and tell orgs never to put
  anything identifying in it. → #11 (sensitive-field classification).
- **Q2. Should free-text notes have a blind index?** The schema has `notes_bidx`, but equality
  search on free text is rarely useful and leaks which members have identical notes (R1). The
  likely answer is no blind index for `notes`. → #11 / #12.
- **Q3. Do deleted rows really leave the browser store?** Postgres (and so PGlite) marks deleted
  rows dead but keeps their bytes in the data files until vacuum reuses the space, and the WAL
  may hold them too. Those bytes are ciphertext, but the key that decrypts them still exists,
  so "delete" isn't yet final against A1 or A7. Options: `VACUUM` after delete and purge,
  per-record data keys so deleting a record destroys its key, or both. → #10 / #13.
- **Q4. Does the PBKDF2 fallback lower the bar?** If libsodium fails to load and the store is
  keyed with PBKDF2, a stolen store is cheaper to brute-force (R6). The decision record should
  say when the fallback is allowed and whether a store can be upgraded to Argon2id later. → #11.

## Revisiting this document

Following Tactical Tech's cycle, treat this as a living document. Review it:

- at the end of each phase,
- after each practitioner conversation logged in `docs/research/` (#2),
- whenever a decision record finds that a row here is wrong.
