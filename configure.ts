import type ConfigureCommand from '@adonisjs/core/commands/configure'

import { ensureLines } from './src/patch_file.js'
import { stubsRoot } from './stubs/main.js'

/** The binary path the generated config defaults to. */
const DEFAULT_BIN = 'vendor/typst'

/**
 * The rendering engine. A peer dependency, not bundled — the application owns
 * which engine version renders its documents, the same reason the binary is a
 * parameter. But it is not optional: the provider imports it at boot, so a
 * configure that skips it leaves an app that crashes on the first request.
 */
const ENGINE_PACKAGE = { name: 'typst-report', isDevDependency: false }

export async function configure(command: ConfigureCommand) {
  const codemods = await command.createCodemods()

  // Installed here so `node ace add @typst-report/adonisjs` is one command, not
  // an install that quietly omits the package everything else depends on.
  // Re-running is harmless: an already-present engine just reinstalls.
  if (!(await codemods.installPackages([ENGINE_PACKAGE]))) {
    // Offline, a registry hiccup, a conflicting tree: don't strand a
    // half-wired app — print the exact command left to run.
    await codemods.listPackagesToInstall([ENGINE_PACKAGE])
  }

  await codemods.makeUsingStub(stubsRoot, 'config.stub', {})

  await codemods.updateRcFile((transformer) => {
    transformer.addProvider('@typst-report/adonisjs/typst_provider')
    transformer.addCommand('@typst-report/adonisjs/commands')
  })

  // Declared so the generated config can read it through `env`, like the
  // rest of an AdonisJS app, instead of reaching for process.env. Optional
  // because the config falls back to the vendored path; the codemod leaves
  // an existing rule alone, so re-running configure never clobbers a
  // stricter one.
  try {
    await codemods.defineEnvValidations({
      leadingComment: 'Variables for @typst-report/adonisjs',
      variables: { TYPST_BIN: 'Env.schema.string.optional()' },
    })
  } catch {
    command.logger.warning(
      'Could not add TYPST_BIN to start/env.ts — add `TYPST_BIN: Env.schema.string.optional()` yourself, or set `bin` directly in config/typst.ts.'
    )
  }

  // The downloaded binary is tens of megabytes. Committing it once is a
  // mistake that outlives the commit, so the ignore rule ships with the
  // command that creates the file rather than with the documentation.
  const ignored = await ensureLines(
    command.app.makePath('.gitignore'),
    DEFAULT_BIN,
    ['', '# Typst binary downloaded by `node ace typst:install`', DEFAULT_BIN].join('\n')
  )
  if (ignored === 'added') {
    command.logger.action('update .gitignore').succeeded()
  } else if (ignored === 'file-missing') {
    command.logger.warning(`No .gitignore found — make sure ${DEFAULT_BIN} never gets committed.`)
  }

  // Documented, not set: TYPST_BIN is optional, and an empty value in .env
  // would win over the fallback and leave `bin` pointing at nothing.
  await ensureLines(
    command.app.makePath('.env.example'),
    'TYPST_BIN',
    [
      '',
      `# Overrides the Typst binary path (default: ${DEFAULT_BIN}, via \`node ace typst:install\`)`,
      '# TYPST_BIN=',
    ].join('\n')
  )

  command.logger.info('Next: run `node ace typst:install` to fetch the pinned binary.')
}
