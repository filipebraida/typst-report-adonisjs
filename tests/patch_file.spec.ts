import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test } from '@japa/runner'

import { ensureLines } from '../src/patch_file.js'

async function scratchFile(contents: string): Promise<[string, () => Promise<void>]> {
  const dir = await mkdtemp(join(tmpdir(), 'typst-configure-'))
  const file = join(dir, '.gitignore')
  await writeFile(file, contents)
  return [file, () => rm(dir, { recursive: true, force: true })]
}

test.group('ensureLines', () => {
  test('appends the block when the marker is absent', async ({ assert }) => {
    const [file, cleanup] = await scratchFile('node_modules\nbuild\n')

    const outcome = await ensureLines(file, 'vendor/typst', '\n# typst\nvendor/typst')

    assert.equal(outcome, 'added')
    const contents = await readFile(file, 'utf8')
    assert.include(contents, 'vendor/typst')
    // What was already there survives.
    assert.include(contents, 'node_modules')
    await cleanup()
  })

  test('is idempotent — configure can run twice', async ({ assert }) => {
    const [file, cleanup] = await scratchFile('node_modules\n')

    await ensureLines(file, 'vendor/typst', '\nvendor/typst')
    const second = await ensureLines(file, 'vendor/typst', '\nvendor/typst')

    assert.equal(second, 'already-present')
    const contents = await readFile(file, 'utf8')
    assert.equal(contents.split('vendor/typst').length - 1, 1)
    await cleanup()
  })

  test('adds the missing newline before appending', async ({ assert }) => {
    const [file, cleanup] = await scratchFile('build')

    await ensureLines(file, 'vendor/typst', 'vendor/typst')

    assert.equal(await readFile(file, 'utf8'), 'build\nvendor/typst\n')
    await cleanup()
  })

  test('reports a missing file instead of creating one', async ({ assert }) => {
    const outcome = await ensureLines('/nope/.gitignore', 'x', 'x')

    assert.equal(outcome, 'file-missing')
  })
})
