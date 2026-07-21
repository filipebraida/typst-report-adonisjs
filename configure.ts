import type ConfigureCommand from '@adonisjs/core/commands/configure'

import { stubsRoot } from './stubs/main.js'

export async function configure(command: ConfigureCommand) {
  const codemods = await command.createCodemods()

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

  command.logger.info('Next: run `node ace typst:install` to fetch the pinned binary.')
}
