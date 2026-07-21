import type ConfigureCommand from '@adonisjs/core/commands/configure'

import { stubsRoot } from './stubs/main.js'

export async function configure(command: ConfigureCommand) {
  const codemods = await command.createCodemods()

  await codemods.makeUsingStub(stubsRoot, 'config.stub', {})

  await codemods.updateRcFile((transformer) => {
    transformer.addProvider('@typst-report/adonisjs/typst_provider')
    transformer.addCommand('@typst-report/adonisjs/commands')
  })

  command.logger.info('Next: run `node ace typst:install` to fetch the pinned binary.')
}
