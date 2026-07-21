import { test } from '@japa/runner'

import { RELEASES, findRelease } from '../src/checksums.js'

test.group('release table', () => {
  test('finds a known version for a known platform', ({ assert }) => {
    const release = findRelease('0.15.1', 'linux-x64')

    assert.isDefined(release)
    assert.match(release!.url, /^https:\/\/github\.com\/typst\/typst\/releases\//)
    assert.lengthOf(release!.sha256, 64)
  })

  test('returns nothing for versions or platforms it does not know', ({ assert }) => {
    assert.isUndefined(findRelease('0.15.1', 'sunos-sparc'))
    assert.isUndefined(findRelease('99.0.0', 'linux-x64'))
  })

  test('every listed hash is a full sha256 over an official release URL', ({ assert }) => {
    for (const [version, platforms] of Object.entries(RELEASES)) {
      for (const [platform, release] of Object.entries(platforms ?? {})) {
        assert.match(
          release!.sha256,
          /^[a-f0-9]{64}$/,
          `${version} ${platform} does not carry a sha256`
        )
        assert.include(release!.url, `/download/v${version}/`)
      }
    }
  })
})
