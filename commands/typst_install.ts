import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, copyFile, mkdir, mkdtemp, readdir, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import { currentPlatform, findRelease } from '../src/checksums.js'
import type { BinaryRelease, TypstConfig } from '../src/types.js'

const execFileAsync = promisify(execFile)

/**
 * Downloads the pinned Typst binary to the configured path, verifying its
 * sha256 before anything is unpacked.
 *
 * Idempotent: if the binary already reports the pinned version it does
 * nothing, so it runs the same in development, CI and deploy. Never a
 * postinstall — that would mean a ~17 MB download on every `npm install`
 * and a broken offline install.
 */
export default class TypstInstall extends BaseCommand {
  static commandName = 'typst:install'
  static description = 'Download the pinned Typst binary (idempotent, checksum-verified)'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Download even if the pinned version is already installed' })
  declare force?: boolean

  async run() {
    const config = this.app.config.get<TypstConfig | undefined>('typst')
    if (!config?.bin) {
      this.logger.error(
        'No "config/typst.ts" found. Run `node ace configure @typst-report/adonisjs`.'
      )
      this.exitCode = 1
      return
    }

    const { bin, version } = config
    if (!version) {
      this.logger.error('Set `version` in config/typst.ts — it is what this command installs.')
      this.exitCode = 1
      return
    }

    if (this.force !== true && (await this.#installedVersion(bin, version))) {
      this.logger.info(`typst ${version} already installed at ${bin}`)
      return
    }

    const release = config.install ?? findRelease(version)
    if (!release) {
      this.logger.error(
        `No known download for typst ${version} on ${currentPlatform()}. ` +
          'Add it to config/typst.ts as `install: { url, sha256 }` — see the official releases at ' +
          'https://github.com/typst/typst/releases'
      )
      this.exitCode = 1
      return
    }

    this.logger.info(`Downloading typst ${version}…`)
    const archive = await this.#download(release)
    if (!archive) return

    await this.#unpack(archive, release, bin)

    if (!(await this.#installedVersion(bin, version))) {
      this.logger.error(`Installed, but \`${bin} --version\` does not report ${version}.`)
      this.exitCode = 1
      return
    }
    this.logger.success(`typst ${version} installed at ${bin}`)
  }

  /** Fetches the archive and refuses it unless the hash matches exactly. */
  async #download(release: BinaryRelease): Promise<Buffer | undefined> {
    const response = await fetch(release.url)
    if (!response.ok) {
      this.logger.error(
        `Download failed: ${response.status} ${response.statusText} (${release.url})`
      )
      this.exitCode = 1
      return undefined
    }

    const archive = Buffer.from(await response.arrayBuffer())
    const digest = createHash('sha256').update(archive).digest('hex')
    if (digest !== release.sha256) {
      this.logger.error(`sha256 mismatch: expected ${release.sha256}, got ${digest}. Aborting.`)
      this.exitCode = 1
      return undefined
    }

    return archive
  }

  async #unpack(archive: Buffer, release: BinaryRelease, bin: string): Promise<void> {
    const scratch = await mkdtemp(join(tmpdir(), 'typst-install-'))
    try {
      const tarball = join(scratch, 'typst.tar.xz')
      await writeFile(tarball, archive)
      await execFileAsync('tar', ['-xJf', tarball, '-C', scratch])

      const dir = release.archiveDir ?? (await this.#soleDirectory(scratch))
      await this.#ensureDirectory(dirname(bin))
      await copyFile(join(scratch, dir, 'typst'), bin)
      await chmod(bin, 0o755)
    } finally {
      await rm(scratch, { recursive: true, force: true })
    }
  }

  /** Typst archives hold a single top-level directory; find it rather than guess its name. */
  async #soleDirectory(scratch: string): Promise<string> {
    const entries = await readdir(scratch, { withFileTypes: true })
    const directories = entries.filter((entry) => entry.isDirectory())
    if (directories.length !== 1) {
      throw new Error(
        `Expected one directory inside the archive, found ${directories.length}. ` +
          'Set `install.archiveDir` in config/typst.ts.'
      )
    }
    return directories[0]!.name
  }

  /**
   * On a deploy where the binary's directory is a shared directory, the
   * release gets a symlink pointing at a target that does not exist yet, and
   * a recursive mkdir over a dangling symlink fails with ENOENT. Create the
   * link's target in that case.
   */
  async #ensureDirectory(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true })
    } catch (error) {
      const target = await readlink(dir).catch(() => null)
      if (target === null) throw error
      await mkdir(resolve(dirname(dir), target), { recursive: true })
    }
  }

  async #installedVersion(bin: string, version: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(bin, ['--version'])
      return stdout.includes(version)
    } catch {
      return false
    }
  }
}
