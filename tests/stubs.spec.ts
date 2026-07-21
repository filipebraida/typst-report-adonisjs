import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { test } from '@japa/runner'
import { compile } from 'tempura'

import { stubsRoot } from '../stubs/main.js'

/**
 * Stubs only run when someone installs the package, so a template error in
 * one is invisible to every other check — it surfaces as a broken
 * `node ace configure` in a stranger's project.
 *
 * The renderer compiles each stub into a JavaScript template literal, which
 * makes a stray backtick in a comment enough to close the string and turn
 * the rest of the file into loose syntax. Rendering them here is the only
 * check that catches that before a consumer does.
 */

/** Mirrors how AdonisJS renders a stub: data keys become template props. */
function render(source: string): string {
  const data = {
    app: {
      configPath: (path: string) => `/app/config/${path}`,
      makePath: (...parts: string[]) => `/app/${parts.join('/')}`,
    },
    randomString: () => 'random',
    generators: {},
    exports: (value: unknown) => `<!--EXPORT_START-->${JSON.stringify(value)}<!--EXPORT_END-->`,
    string: {},
  }

  return compile(source, { props: Object.keys(data) })(data).trim()
}

test.group('stubs', () => {
  test('every stub compiles and renders', async ({ assert }) => {
    const entries = await readdir(stubsRoot)
    const files = entries.filter((entry) => entry.endsWith('.stub'))
    assert.isAbove(files.length, 0, 'no stubs found')

    for (const file of files) {
      const source = await readFile(join(stubsRoot, file), 'utf8')

      const output = render(source)

      assert.isAbove(output.length, 0, `${file} rendered empty`)
      // The front matter has to declare a destination, or nothing is written.
      assert.include(output, '<!--EXPORT_START-->', `${file} declares no exports() target`)
    }
  })

  test('the config stub renders importable config', async ({ assert }) => {
    const source = await readFile(join(stubsRoot, 'config.stub'), 'utf8')

    const output = render(source)

    assert.include(output, "from '@typst-report/adonisjs'")
    assert.include(output, 'defineConfig({')
    assert.include(output, 'version:')
    assert.include(output, 'bin:')
    assert.include(output, 'config/typst.ts')
    // Reads the environment the way the rest of an AdonisJS app does —
    // configure declares TYPST_BIN in start/env.ts to make this safe.
    assert.include(output, "import env from '#start/env'")
    assert.include(output, "env.get('TYPST_BIN')")
    assert.notInclude(output, 'process.env')
  })
})
