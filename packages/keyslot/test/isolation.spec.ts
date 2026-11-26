// @vitest-environment node
// Record 0007, decision 12: test 23. The package stands alone: it imports only its own files,
// libsodium and (in tests) the test runner and Node built-ins. Nothing from Cadre's src/.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|js|mjs)$/.test(entry.name) ? [path] : []
  })
}

function importsOf(file: string): string[] {
  return [...readFileSync(file, 'utf-8').matchAll(IMPORT)].map((m) => (m[1] ?? m[2])!)
}

describe('package isolation', () => {
  it('src/ imports only its own files and libsodium-wrappers-sumo', () => {
    const files = sourceFiles(join(PACKAGE_ROOT, 'src'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      for (const specifier of importsOf(file)) {
        if (specifier.startsWith('.')) {
          const target = resolve(dirname(file), specifier)
          expect(
            relative(join(PACKAGE_ROOT, 'src'), target).startsWith('..'),
            `${file}: ${specifier}`,
          ).toBe(false)
        } else {
          expect(specifier, file).toBe('libsodium-wrappers-sumo')
        }
      }
    }
  })

  it('test/ reaches outside the package only for vitest and Node built-ins', () => {
    for (const file of sourceFiles(join(PACKAGE_ROOT, 'test'))) {
      for (const specifier of importsOf(file)) {
        if (specifier.startsWith('.')) {
          const target = resolve(dirname(file), specifier)
          expect(relative(PACKAGE_ROOT, target).startsWith('..'), `${file}: ${specifier}`).toBe(
            false,
          )
        } else {
          expect(
            specifier === 'vitest' ||
              specifier.startsWith('node:') ||
              specifier === 'libsodium-wrappers-sumo',
            `${file}: ${specifier}`,
          ).toBe(true)
        }
      }
    }
  })

  it('declares only libsodium-wrappers-sumo as a dependency, under Apache-2.0', () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8'))
    expect(manifest.name).toBe('keyslot')
    expect(manifest.license).toBe('Apache-2.0')
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(['libsodium-wrappers-sumo'])
    expect(manifest.peerDependencies).toBeUndefined()
    expect(readFileSync(join(PACKAGE_ROOT, 'LICENSE'), 'utf-8')).toContain('Apache License')
  })
})
