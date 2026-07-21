import type { BinaryRelease } from './types.js'

/**
 * Known Typst releases, by version and `${platform}-${arch}`.
 *
 * Every hash here has been verified against the official GitHub release
 * before being added — a wrong entry fails closed (the download is
 * rejected), but a *fabricated* one would defeat the check entirely, so
 * entries are only added when someone has actually downloaded and compared.
 * That is also why the table is deliberately small: `TypstConfig.install`
 * accepts an explicit `{ url, sha256 }`, so an unlisted version or platform
 * is never blocked waiting on a release of this package.
 */
export const RELEASES: Record<string, Record<string, BinaryRelease | undefined> | undefined> = {
  '0.15.1': {
    'linux-x64': {
      url: 'https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz',
      sha256: 'a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c',
      archiveDir: 'typst-x86_64-unknown-linux-musl',
    },
  },
}

/** The current host, in the key format `RELEASES` uses. */
export function currentPlatform(): string {
  return `${process.platform}-${process.arch}`
}

/** The pinned release for this version on this host, if the table knows it. */
export function findRelease(
  version: string,
  platform = currentPlatform()
): BinaryRelease | undefined {
  return RELEASES[version]?.[platform]
}
