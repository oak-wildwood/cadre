import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

// Record 0004: GitHub Pages and Vercel previews may only ever serve the landing page.
describe('production build', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'cadre-build-'))
  afterAll(() => rmSync(outDir, { recursive: true, force: true }))

  it('contains the landing page and none of the ledger', async () => {
    await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } })

    const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name))
    const names = files.map((f) => f.slice(outDir.length + 1))
    expect(names).toContain('index.html')
    expect(names).not.toContain('app.html')
    // PGlite's wasm and data files are the clearest sign of storage code, even if minified.
    expect(names.filter((n) => /\.(wasm|data)$/.test(n))).toEqual([])

    const text = files
      .filter((f) => /\.(html|js|css)$/.test(f))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
    expect(text).toContain('What it is') // the landing page is there
    expect(text).toContain('--color-bg') // and its shared theme tokens
    for (const marker of ['key_slots', 'PGlite', 'findByBlindIndex', 'Unlock']) {
      expect(text, marker).not.toContain(marker)
    }
  }, 120_000)
})
