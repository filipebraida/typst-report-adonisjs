import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Compiles one template with real data and writes the result to disk.
 *
 * Template work is the actual work of using this library, and it does not
 * need a browser, a route or a session to iterate on: point this at a `.typ`
 * and a JSON file and look at the output.
 */
export default class TypstPreview extends BaseCommand {
  static commandName = 'typst:preview'
  static description = 'Render a template with data straight to a file'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Path to the .typ template' })
  declare template: string

  @flags.string({ description: 'Path to a JSON file with the view model', alias: 'd' })
  declare data?: string

  @flags.boolean({ description: 'Render to PNG instead of PDF' })
  declare png?: boolean

  @flags.boolean({ description: 'Render to SVG instead of PDF' })
  declare svg?: boolean

  @flags.string({ description: 'Pages to export, e.g. 1 or 2-4', alias: 'p' })
  declare pages?: string

  @flags.string({ description: 'Output directory (default: tmp/typst-preview)', alias: 'o' })
  declare out?: string

  async run() {
    const typst = await this.app.container.make('typst.manager')

    const data: unknown = this.data ? JSON.parse(await readFile(this.data, 'utf8')) : {}
    const template = this.app.makePath(this.template)
    const pages = this.pages ? this.pages.split(',').map((page) => page.trim()) : undefined
    const outDir = this.app.makePath(this.out ?? 'tmp/typst-preview')
    await mkdir(outDir, { recursive: true })

    const name = basename(template, extname(template))
    const started = Date.now()

    if (this.png === true || this.svg === true) {
      const format = this.png === true ? 'png' : 'svg'
      const buffers = await typst.compile({
        template,
        data,
        format,
        ...(pages ? { pages } : {}),
      })
      await Promise.all(
        buffers.map((buffer, index) =>
          writeFile(join(outDir, `${name}-${index + 1}.${format}`), buffer)
        )
      )
      this.logger.success(
        `${buffers.length} ${format} file(s) in ${outDir} (${Date.now() - started} ms)`
      )
      return
    }

    const pdf = await typst.compile({ template, data, ...(pages ? { pages } : {}) })
    const target = join(outDir, `${name}.pdf`)
    await writeFile(target, pdf)
    this.logger.success(`${target} — ${pdf.length} bytes (${Date.now() - started} ms)`)
  }
}
