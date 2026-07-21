import type { CommandMetaData } from '@adonisjs/core/types/ace'

/**
 * Static index of commands shipped by @typst-report/adonisjs.
 *
 * AdonisJS resolves commands published by a package by importing the
 * package's "commands" entry and calling getMetaData() / getCommand().
 */
const commands: Array<{
  commandName: string
  importer: () => Promise<{ default: { serialize(): CommandMetaData } & Function }>
}> = [
  {
    commandName: 'typst:install',
    importer: () => import('./typst_install.js'),
  },
  {
    commandName: 'typst:doctor',
    importer: () => import('./typst_doctor.js'),
  },
  {
    commandName: 'typst:preview',
    importer: () => import('./typst_preview.js'),
  },
]

let metaDataCache: CommandMetaData[] | null = null

export async function getMetaData(): Promise<CommandMetaData[]> {
  if (metaDataCache) return metaDataCache
  const items = await Promise.all(
    commands.map(async ({ importer }) => {
      const mod = await importer()
      return mod.default.serialize()
    })
  )
  metaDataCache = items
  return items
}

export async function getCommand(metaData: CommandMetaData) {
  const match = commands.find(({ commandName }) => commandName === metaData.commandName)
  if (!match) return null
  const mod = await match.importer()
  return mod.default
}
