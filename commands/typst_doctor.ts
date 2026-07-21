import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Verifies the rendering environment before it shows up as a wrong PDF:
 * the binary at the pinned version, the fonts the templates name, and the
 * libraries (which the engine reads lazily, at the first compile).
 *
 * Exits non-zero when anything is off, so it belongs in a deploy pipeline
 * right after `typst:install` — failing there beats booting and failing at
 * the first request.
 */
export default class TypstDoctor extends BaseCommand {
  static commandName = 'typst:doctor'
  static description = 'Diagnose the Typst binary, version, fonts and libraries'
  static options: CommandOptions = { startApp: true }

  async run() {
    const typst = await this.app.container.make('typst.manager')
    const diagnosis = await typst.check()
    const { binary, version, fonts, libraries } = diagnosis

    this.logger.log(`binary: ${binary.ok ? binary.bin : `${binary.bin} — ${binary.error}`}`)

    // An unevaluated section is a symptom of the dead binary, not a problem
    // of its own: printing it would send someone hunting for a font that was
    // never actually checked.
    if (version?.evaluated) {
      this.logger.log(`version: ${version.actual} (expected ${version.expected})`)
    }
    if (fonts?.evaluated && !fonts.ok) {
      this.logger.log(`missing fonts: ${fonts.missing.join(', ')}`)
      this.logger.log(`visible fonts: ${fonts.available.join(', ')}`)
    }
    if (!libraries.ok) {
      this.logger.log(`libraries: ${libraries.error}`)
    }

    if (diagnosis.ok) {
      this.logger.success('rendering environment ok')
      return
    }

    this.logger.error('rendering environment inconsistent')
    this.exitCode = 1
  }
}
