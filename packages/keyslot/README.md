# keyslot

Passphrase key slots and per-field AES-256-GCM encryption for browser apps. It composes
libsodium (`libsodium-wrappers-sumo`: Argon2id, `crypto_kdf`, padding, `memzero`) and WebCrypto
(AES-GCM, HMAC) and implements no primitive itself. It knows nothing about the app using it and
does no I/O: you store the slot bytes and the ciphertexts wherever you like.

Licensed Apache-2.0, separately from Cadre (AGPL-3.0). The full design and its reasons are in
Cadre's [decision record 0007](../../docs/decisions/0007-key-derivation.md).

## How it works

```
passphrase ──Argon2id──▶ wrapping key ──AES-GCM unwrap(slot)──▶ random master key
                                                     crypto_kdf │ id 1 "fieldenc", id 2 "blindidx"
                                              field key (AES-GCM) + blind-index key (HMAC-SHA-256)
```

- **No stored secret.** The slot holds the master key wrapped by the passphrase. A forgotten
  passphrase means the data is gone; there is no recovery.
- **Argon2id at libsodium "moderate"** (3 passes, 256 MiB) for new slots. Each slot records its
  own settings, and unlock always uses them. Stored settings below "interactive" or above
  "sensitive" are rejected before Argon2id runs. No PBKDF2 fallback: if libsodium or WebCrypto
  is missing, everything throws `CryptoUnavailableError`.
- **Field values** are `0x01 ‖ nonce(12) ‖ AES-256-GCM(pad32(value))`. The AAD binds each value to
  a `{ namespace, recordId, field }`, so it only decrypts where it was written. Values are padded
  to 32 bytes so short values don't leak their length.
- **Keys stay in WebCrypto** as non-extractable `CryptoKey`s in a `KeyRing`. `lock()` drops them.

## Use

```ts
import { createPassphraseSlot, unlock } from 'keyslot'

const { slot, keyRing } = await createPassphraseSlot(passphrase) // store `slot`
const binding = { namespace: 'members', recordId: id, field: 'email' }
const value = await keyRing.encryptField(new TextEncoder().encode(email), binding)

const ring = await unlock(passphrase, slot) // throws UnlockError on a wrong passphrase
const email = new TextDecoder().decode(await ring.decryptField(value, binding))
ring.lock()
```

`rewrapPassphraseSlot(passphrase, slot, newPassphrase)` re-wraps the same master key, e.g. to
raise the Argon2id settings after `readSlotParams(slot)` shows they are below
`DEFAULT_KDF_PARAMS`. It does **not** lock out someone holding the old slot and passphrase. For
that, make a new slot and re-encrypt every value (a rotation), which the app has to do since
only it can walk its rows.

## Errors

`UnlockError` (wrong passphrase, damaged or tampered slot: deliberately indistinguishable),
`DecryptError`, `LockedError`, `CryptoUnavailableError` and `UnsupportedFormatError` (written by
a newer format version). Messages are fixed strings with no cause attached, so they never carry
a passphrase, plaintext or key material.

## Requirements and limits

- A secure context (HTTPS or localhost) for `crypto.subtle`, and a CSP that allows
  `'wasm-unsafe-eval'` in `script-src`.
- 256 MiB free for the moment of unlock. Run unlock in a Web Worker so the page doesn't freeze.
- Non-extractable keys stop a script from copying the key, not from using it while unlocked.
  JavaScript can't guarantee memory is wiped; `memzero` is best effort.

## Status

Consumed from source inside the Cadre workspace (`exports` points at `src/index.ts`). It needs
a build step before it is published to npm, and should move to its own repository before it
takes outside contributions.
