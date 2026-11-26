/**
 * `LedgerRepository` on PGlite (Postgres in WebAssembly), persisted to IndexedDB in the browser.
 * See `docs/dev.md` for why IndexedDB rather than OPFS, and how to inspect the store.
 *
 * The adapter only ever writes ciphertext (`*_enc`) and HMACs (`*_bidx`) for the fields listed
 * in `sensitiveFields.ts`; plaintext exists only in memory, inside the `Member` objects it
 * returns. Filtering and ordering use structural columns only.
 */
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { UnsupportedFormatError, type KdfParams, type KeyRing } from 'keyslot'

import { BLIND_INDEX_RULES_VERSION, blindIndex } from '../crypto/blindIndex'
import { openBundle, sealBundle } from '../crypto/interimExportBundle'
import {
  decryptMemberFields,
  encryptMemberField,
  encryptMemberFields,
  newMemberId,
  type EncryptedValues,
  type SensitiveValues,
} from '../crypto/memberFields'
import type {
  ExportOptions,
  ImportOptions,
  ImportResult,
  LedgerRepository,
  PurgeResult,
} from '../domain/LedgerRepository'
import type { ListOrderField, ListQuery, Page } from '../domain/listQuery'
import type { Member, MemberId, MemberPatch, NewMember } from '../domain/member'
import {
  BLIND_INDEXED_FIELDS,
  SENSITIVE_FIELD_NAMES,
  blindIndexColumn,
  encryptedColumn,
  type BlindIndexedField,
} from '../domain/sensitiveFields'
import { BUNDLED_MIGRATIONS } from './bundledMigrations'
import { migrate, type Migration } from './migrate'

/** The browser store's default location: an IndexedDB database named `/pglite/cadre`. */
export const DEFAULT_DATA_DIR = 'idb://cadre'

export interface PGliteRepositoryOptions {
  /** Unlocked keys for this store. The repository never sees the passphrase. */
  keyRing: KeyRing
  /** `idb://<name>` in the browser, a directory in Node, omitted for in-memory. Ignored with `db`. */
  dataDir?: string
  /** An already-open PGlite; the repository closes it on `close()`. */
  db?: PGlite
  /** Defaults to the `migrations/*.sql` files bundled at build time. */
  migrations?: Migration[]
  /** Argon2id settings for export bundles. Defaults to keyslot's defaults; tests lower them. */
  exportKdf?: KdfParams
}

type Queryable = Pick<PGlite | Transaction, 'query'>
type Row = Record<string, unknown>

const DEFAULT_LIMIT = 20
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ORDER_EXPRESSIONS: Record<ListOrderField, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  // Nulls ("never expires") sort first ascending, matching the reference repository.
  expiresAt: "COALESCE(expires_at, '-infinity'::timestamptz)",
}

const ENC_COLUMNS = SENSITIVE_FIELD_NAMES.map(encryptedColumn)
const SELECT_COLUMNS = ['id', 'created_at', 'updated_at', 'expires_at', ...ENC_COLUMNS].join(', ')

export class MemberNotFoundError extends Error {
  constructor() {
    // No id in the message: ids are not PII, but messages end up in error reports.
    super('Member not found')
    this.name = 'MemberNotFoundError'
  }
}

export class PGliteRepository implements LedgerRepository {
  private readonly keyRing: KeyRing
  private readonly exportKdf: KdfParams | undefined
  private readonly db: PGlite
  private readonly opened: Promise<PGlite>

  /**
   * Opens (or creates) the store and runs pending migrations in the background. Every method
   * waits for that, so a failed open surfaces on the first call.
   */
  constructor(options: PGliteRepositoryOptions) {
    this.keyRing = options.keyRing
    this.exportKdf = options.exportKdf
    const db = options.db ?? new PGlite(options.dataDir)
    this.db = db
    const migrations = options.migrations ?? BUNDLED_MIGRATIONS
    this.opened = migrate(async (sql) => {
      const results = await db.exec(sql)
      return results[results.length - 1] ?? { rows: [] }
    }, migrations)
      .then(() => this.syncBlindIndexRules(db))
      .then(() => db)
    // Keep an unawaited open failure from being reported as unhandled; callers still see it.
    this.opened.catch(() => {})
  }

  /** Resolves once migrations have run. */
  async ready(): Promise<void> {
    await this.opened
  }

  /** Closes the database, even if opening it failed. */
  async close(): Promise<void> {
    await this.opened.catch(() => {})
    if (!this.db.closed) {
      await this.db.close()
    }
  }

  async create(input: NewMember): Promise<Member> {
    const db = await this.opened
    const id = newMemberId()
    const row = await this.insert(db, id, input, null)
    return this.toMember(row)
  }

  async read(id: MemberId): Promise<Member | null> {
    if (!isUuid(id)) {
      return null
    }
    const db = await this.opened
    const { rows } = await db.query<Row>(`SELECT ${SELECT_COLUMNS} FROM members WHERE id = $1`, [
      id,
    ])
    return rows[0] ? this.toMember(rows[0]) : null
  }

  async update(id: MemberId, patch: MemberPatch): Promise<Member> {
    if (!isUuid(id)) {
      throw new MemberNotFoundError()
    }
    if ('displayName' in patch && patch.displayName == null) {
      throw new TypeError('displayName is required')
    }
    const db = await this.opened
    const row = await db.transaction(async (tx) => {
      const { rows } = await tx.query<Row>(`SELECT id FROM members WHERE id = $1 FOR UPDATE`, [id])
      if (!rows[0]) {
        throw new MemberNotFoundError()
      }

      const assignments: string[] = []
      const values: unknown[] = []
      const set = (column: string, value: unknown) => {
        values.push(value)
        assignments.push(`${column} = $${values.length}`)
      }

      for (const field of SENSITIVE_FIELD_NAMES) {
        if (patch[field] === undefined) {
          continue
        }
        const value = patch[field]
        set(encryptedColumn(field), await encryptMemberField(this.keyRing, id, field, value))
        if (isBlindIndexed(field)) {
          set(blindIndexColumn(field), await this.indexFor(field, value))
        }
      }
      if (patch.expiresAt !== undefined) {
        set('expires_at', checkedDate(patch.expiresAt))
      }
      assignments.push('updated_at = clock_timestamp()')

      values.push(id)
      const result = await tx.query<Row>(
        `UPDATE members SET ${assignments.join(', ')} WHERE id = $${values.length}
         RETURNING ${SELECT_COLUMNS}`,
        values,
      )
      return result.rows[0]!
    })
    return this.toMember(row)
  }

  async delete(id: MemberId): Promise<void> {
    if (!isUuid(id)) {
      return
    }
    const db = await this.opened
    const { affectedRows } = await db.query(`DELETE FROM members WHERE id = $1`, [id])
    if (affectedRows) {
      await reclaim(db)
    }
  }

  async list(query: ListQuery = {}): Promise<Page<Member>> {
    const {
      limit = DEFAULT_LIMIT,
      cursor = null,
      orderBy = 'createdAt',
      orderDirection = 'asc',
      filter,
    } = query
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError('limit must be a positive integer')
    }
    if (!Object.hasOwn(ORDER_EXPRESSIONS, orderBy)) {
      throw new RangeError('orderBy must be createdAt, updatedAt or expiresAt')
    }
    const orderExpression = ORDER_EXPRESSIONS[orderBy]
    if (orderDirection !== 'asc' && orderDirection !== 'desc') {
      throw new RangeError('orderDirection must be asc or desc')
    }
    const comparison = orderDirection === 'asc' ? '>' : '<'

    const db = await this.opened
    const where: string[] = []
    const values: unknown[] = []
    const param = (value: unknown) => {
      values.push(value)
      return `$${values.length}`
    }

    if (filter?.expiresBefore !== undefined) {
      where.push(`expires_at < ${param(checkedDate(filter.expiresBefore))}`)
    }
    if (filter?.expiresAfter !== undefined) {
      where.push(`expires_at > ${param(checkedDate(filter.expiresAfter))}`)
    }
    if (cursor !== null) {
      // Keyset pagination: the cursor is the last id of the previous page. The sort key is
      // compared inside Postgres, never round-tripped through a JS Date (which would lose
      // precision and can't hold '-infinity'), and `seq` breaks ties in insertion order.
      const { rows } = isUuid(cursor)
        ? await db.query<Row>(`SELECT 1 FROM members WHERE id = $1`, [cursor])
        : { rows: [] }
      if (!rows[0]) {
        throw new RangeError('Unknown cursor')
      }
      where.push(
        `(${orderExpression}, seq) ${comparison} ` +
          `(SELECT ${orderExpression}, seq FROM members WHERE id = ${param(cursor)})`,
      )
    }

    const direction = orderDirection.toUpperCase()
    const { rows } = await db.query<Row>(
      `SELECT ${SELECT_COLUMNS} FROM members
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ${orderExpression} ${direction}, seq ${direction}
       LIMIT ${param(limit + 1)}`,
      values,
    )

    const pageRows = rows.slice(0, limit)
    const items = await Promise.all(pageRows.map((row) => this.toMember(row)))
    const nextCursor = rows.length > limit ? (items.at(-1)?.id ?? null) : null
    return { items, nextCursor }
  }

  async findByBlindIndex(field: BlindIndexedField, value: string): Promise<Member[]> {
    if (!isBlindIndexed(field)) {
      // A runtime guard for callers that cast around the type: role and notes have no index.
      throw new TypeError('Field has no blind index')
    }
    const db = await this.opened
    const index = await blindIndex(this.keyRing, field, value)
    if (index === null) {
      // A blank search matches nothing, not every member with a blank field (record 0008).
      return []
    }
    const { rows } = await db.query<Row>(
      `SELECT ${SELECT_COLUMNS} FROM members WHERE ${blindIndexColumn(field)} = $1
       ORDER BY created_at, seq`,
      [index],
    )
    return Promise.all(rows.map((row) => this.toMember(row)))
  }

  async purgeExpired(now: Date = new Date()): Promise<PurgeResult> {
    const db = await this.opened
    const { affectedRows = 0 } = await db.query(
      `DELETE FROM members WHERE expires_at IS NOT NULL AND expires_at <= $1`,
      [checkedDate(now)],
    )
    if (affectedRows) {
      await reclaim(db)
    }
    return { purged: affectedRows }
  }

  async exportEncrypted(opts: ExportOptions): Promise<Uint8Array> {
    const db = await this.opened
    const { rows } = await db.query<Row>(
      `SELECT ${SELECT_COLUMNS} FROM members ORDER BY created_at, seq`,
    )
    const members = await Promise.all(rows.map((row) => this.toMember(row)))
    const payload = new TextEncoder().encode(JSON.stringify({ members }))
    return sealBundle(payload, opts.passphrase, this.exportKdf)
  }

  /** Replace-only for now (#14 decides merge semantics): refuses a store that has members. */
  async importEncrypted(bundle: Uint8Array, opts: ImportOptions): Promise<ImportResult> {
    const payload = await openBundle(bundle, opts.passphrase)
    const members = parsePayload(payload)
    const db = await this.opened
    await db.transaction(async (tx) => {
      const { rows } = await tx.query<Row>(`SELECT 1 FROM members LIMIT 1`)
      if (rows.length) {
        throw new Error('Import needs an empty store')
      }
      for (const member of members) {
        await this.insert(tx, member.id, member, member)
      }
    })
    return { imported: members.length }
  }

  private async insert(
    db: Queryable,
    id: MemberId,
    input: NewMember,
    timestamps: Pick<Member, 'createdAt' | 'updatedAt'> | null,
  ): Promise<Row> {
    if (input.displayName == null) {
      throw new TypeError('displayName is required')
    }
    const indexes: unknown[] = []
    for (const field of BLIND_INDEXED_FIELDS) {
      indexes.push(await this.indexFor(field, input[field] ?? null))
    }
    const encrypted = await encryptMemberFields(this.keyRing, id, pickSensitive(input))
    const columns = ['id', 'expires_at', ...ENC_COLUMNS]
    const values: unknown[] = [
      id,
      checkedDate(input.expiresAt),
      ...SENSITIVE_FIELD_NAMES.map((f) => encrypted[f]),
    ]
    columns.push(...BLIND_INDEXED_FIELDS.map(blindIndexColumn))
    values.push(...indexes)
    const placeholders = values.map((_, i) => `$${i + 1}`)
    if (timestamps) {
      columns.push('created_at', 'updated_at')
      values.push(checkedDate(timestamps.createdAt), checkedDate(timestamps.updatedAt))
      placeholders.push(`$${values.length - 1}`, `$${values.length}`)
    } else {
      // clock_timestamp(), not now(): the time of this statement. Ties (PGlite's clock ticks
      // in milliseconds) are ordered by `seq`.
      columns.push('created_at', 'updated_at')
      placeholders.push('clock_timestamp()', 'clock_timestamp()')
    }
    const { rows } = await db.query<Row>(
      `INSERT INTO members (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
       RETURNING ${SELECT_COLUMNS}`,
      values,
    )
    return rows[0]!
  }

  /**
   * The index to store for a field. `displayName` is required and its column is NOT NULL, so a
   * name that normalizes to empty is rejected here, before anything is written.
   */
  private async indexFor(
    field: BlindIndexedField,
    value: string | null,
  ): Promise<Uint8Array | null> {
    const index = value === null ? null : await blindIndex(this.keyRing, field, value)
    if (index === null && field === 'displayName') {
      throw new TypeError('displayName is required')
    }
    return index
  }

  /**
   * Record 0008, decision 5: if the store's indexes were built under other normalization rules
   * (or unknown ones, from before the version was recorded), recompute every index and record
   * this build's version, in one transaction. A store from a newer build is refused rather than
   * searched with rules that don't match its indexes.
   */
  private async syncBlindIndexRules(db: PGlite): Promise<void> {
    await db.transaction(async (tx) => {
      const { rows } = await tx.query<{ v: number | null }>(
        `SELECT blind_index_rules_version AS v FROM settings FOR UPDATE`,
      )
      const stored = rows[0]?.v ?? null
      if (stored === BLIND_INDEX_RULES_VERSION) {
        return
      }
      if (stored !== null && stored > BLIND_INDEX_RULES_VERSION) {
        throw new UnsupportedFormatError()
      }
      const members = await tx.query<Row>(`SELECT ${SELECT_COLUMNS} FROM members`)
      for (const row of members.rows) {
        const member = await this.toMember(row)
        const assignments: string[] = []
        const values: unknown[] = []
        for (const field of BLIND_INDEXED_FIELDS) {
          const value = member[field] ?? null
          const index = value === null ? null : await blindIndex(this.keyRing, field, value)
          if (index === null && field === 'displayName') {
            // Written before names had to normalize to something; the column is NOT NULL, so
            // keep the old index rather than refuse to open the store.
            continue
          }
          values.push(index)
          assignments.push(`${blindIndexColumn(field)} = $${values.length}`)
        }
        values.push(member.id)
        await tx.query(
          `UPDATE members SET ${assignments.join(', ')} WHERE id = $${values.length}`,
          values,
        )
      }
      await tx.query(
        `INSERT INTO settings (id, blind_index_rules_version) VALUES (true, $1)
         ON CONFLICT (id) DO UPDATE
         SET blind_index_rules_version = EXCLUDED.blind_index_rules_version,
             updated_at = now()`,
        [BLIND_INDEX_RULES_VERSION],
      )
    })
  }

  private async toMember(row: Row): Promise<Member> {
    const id = String(row.id)
    const encrypted = Object.fromEntries(
      SENSITIVE_FIELD_NAMES.map((field) => [
        field,
        (row[encryptedColumn(field)] ?? null) as Uint8Array | null,
      ]),
    ) as EncryptedValues
    const sensitive = await decryptMemberFields(this.keyRing, id, encrypted)
    return {
      id,
      ...sensitive,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      expiresAt: (row.expires_at as Date | null) ?? null,
    }
  }
}

/**
 * Rewrites `members` so a deleted row's bytes leave the live data files rather than waiting for
 * vacuum to reuse the space (docs/threat-model.md, Q3). The store is small, so this is cheap.
 * It does not cover copies already synced elsewhere or WAL segments; see docs/dev.md.
 */
async function reclaim(db: PGlite): Promise<void> {
  await db.exec('VACUUM FULL members')
}

function pickSensitive(input: NewMember): SensitiveValues {
  return Object.fromEntries(
    SENSITIVE_FIELD_NAMES.map((f) => [f, input[f] ?? null]),
  ) as SensitiveValues
}

function isBlindIndexed(field: string): field is BlindIndexedField {
  return (BLIND_INDEXED_FIELDS as string[]).includes(field)
}

function isUuid(value: string): boolean {
  return typeof value === 'string' && UUID.test(value)
}

function checkedDate(value: Date | null): Date | null {
  if (value === null) {
    return null
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('Expected a valid Date')
  }
  return value
}

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'expiresAt'])

function parsePayload(payload: Uint8Array): Member[] {
  const parsed = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(payload),
    (key, value) => (DATE_FIELDS.has(key) && typeof value === 'string' ? new Date(value) : value),
  ) as { members?: unknown }
  if (!Array.isArray(parsed.members)) {
    throw new Error('Export bundle has no member list')
  }
  return parsed.members as Member[]
}
