// @vitest-environment node
/**
 * Record 0004: the GitHub Pages and Vercel preview builds carry the landing page only, never the
 * ledger UI. `app.html` is a separate Vite entry that `vite build` doesn't bundle; this builds the
 * real production config and checks nothing from the ledger made it in.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

const outDir = mkdtempSync(join(tmpdir(), 'cadre-build-'))

afterAll(() => rmSync(outDir, { recursive: true, force: true }))

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

describe('production build', () => {
  it('ships the landing page and none of the ledger UI', async () => {
    await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } })
    const output = files(outDir)
    const text = output.map((file) => readFileSync(file, 'latin1')).join('\n')

    expect(output.some((file) => file.endsWith('index.html'))).toBe(true)
    expect(output.some((file) => file.endsWith('app.html'))).toBe(false)
    // Strings only the ledger UI contains.
    expect(text).not.toContain('Create ledger')
    expect(text).not.toContain('key_slots')
    expect(text).not.toContain('pglite')
  }, 60_000)
})
