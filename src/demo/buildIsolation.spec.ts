// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Record 0004: nothing demo-shaped may reach a production bundle. This runs the real production
// build in a child process (Vitest sets NODE_ENV=test, which would turn the dev-only gate on)
// and looks for the roster, so a refactor that drops the `import.meta.env.DEV` gate fails here
// instead of shipping fixtures to Pages or Vercel.
describe('demo roster in a production build', () => {
  it('is not bundled', () => {
    const out = mkdtempSync(join(tmpdir(), 'cadre-build-'))
    try {
      execFileSync('npx', ['vite', 'build', '--logLevel', 'silent', '--outDir', out], {
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: 'pipe',
      })
      const files = readdirSync(out, { recursive: true, withFileTypes: true }).filter((e) =>
        e.isFile(),
      )
      expect(files.length).toBeGreaterThan(0)
      for (const file of files) {
        const path = join(file.parentPath, file.name)
        expect(path).not.toMatch(/demo/i)
        expect(readFileSync(path, 'utf8'), path).not.toMatch(
          /Soledad Brother|Harpers Ferry|Load demo roster|loadDemoRoster|example\.invalid/,
        )
      }
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  }, 90_000)
})
