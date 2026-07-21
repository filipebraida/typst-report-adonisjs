# @typst-report/adonisjs

[![checks](https://github.com/filipebraida/typst-report-adonisjs/actions/workflows/checks.yml/badge.svg)](https://github.com/filipebraida/typst-report-adonisjs/actions/workflows/checks.yml)
[![npm](https://img.shields.io/npm/v/@typst-report/adonisjs)](https://www.npmjs.com/package/@typst-report/adonisjs)

AdonisJS integration for [typst-report](https://github.com/filipebraida/typst-report) —
PDF rendering with Typst, wired into the container, the config, ace and the
test suite.

The engine knows nothing about boot, containers, requests or test
environments, and that is what keeps it portable. This package is where those
opinions live.

## Install

```bash
npm install @typst-report/adonisjs typst-report
node ace configure @typst-report/adonisjs
node ace typst:install
```

`configure` writes `config/typst.ts`, registers the provider and commands,
declares `TYPST_BIN` in `start/env.ts`, and adds the binary's path to
`.gitignore` — it is tens of megabytes, and committing it once is a mistake
that outlives the commit. `typst:install` then downloads the pinned binary,
verifying its checksum.

## Configure

`config/typst.ts` declares both the runtime parameters and the
**expectations** — the expectations are what make `typst:doctor` a one-line
deploy gate:

```ts
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@typst-report/adonisjs'

export default defineConfig({
  version: '0.15.1', // installed and asserted
  bin: process.env.TYPST_BIN ?? app.makePath('vendor/typst'),
  fonts: ['Lato', 'JetBrains Mono'], // asserted; Typst falls back silently
  fontPath: app.makePath('resources/typst/fonts'),
  libraries: {
    'lib/brand.typ': { path: app.makePath('resources/typst/lib/brand.typ') },
    'img/logo.svg': { path: app.makePath('resources/images/logo.svg') },
  },
  concurrency: 1,
  timeoutMs: 15_000,
})
```

## Render

```ts
import typst from '@typst-report/adonisjs/services/main'
import { signalFromResponse } from '@typst-report/adonisjs/http'

const pdf = await typst.compile({
  template: app.makePath('app/documents/one_pager.typ'),
  data: viewModel,
  files: { 'img/cover.webp': coverBuffer },
  signal: signalFromResponse(response),
})
```

The renderer is a container singleton, so the concurrency gate cannot be lost
by constructing one per request. Inject it where you prefer that to the
service module:

```ts
import { inject } from '@adonisjs/core'
import type { TypstManager } from '@typst-report/adonisjs'

@inject()
export class OnePagerService {
  constructor(private typst: TypstManager) {}
}
```

## HTTP

Two behaviours are counter-intuitive enough to be worth a helper, and both
cost a production incident to learn:

```ts
import { handleTypstError, signalFromResponse } from '@typst-report/adonisjs/http'

// In the exception handler:
if (handleTypstError(error, ctx)) return
```

- **A cancelled render is not a server error.** `signalFromResponse` watches
  the connection and checks `writableFinished` — `close` fires on successful
  delivery too, so without that check every completed download is recorded as
  a client abort. When the client really did leave, `handleTypstError`
  answers **499** and reports nothing.
- **A missing binary is not a request error.** It raises a **503** naming the
  path, so the fix lands with whoever provisions the host.

## Test

```ts
import typst from '@typst-report/adonisjs/services/main'

test.group('one pager', (group) => {
  group.each.setup(() => {
    typst.fake()
    return () => typst.restore()
  })

  test('sends the record to the template', async ({ client, assert }) => {
    const fake = typst.fake()
    await client.get('/technologies/1/one-pager.pdf')

    assert.equal(fake.lastRender?.data.title, 'Polymer compositions')
    assert.instanceOf(fake.lastRender?.signal, AbortSignal)
  })
})
```

Specs asserting headers, ETags and authorization stop depending on a Typst
binary being installed, and the view model that reached the template becomes
a plain assertion. `typst.restore()` also lets a minority of specs compile for
real, to protect the templates themselves.

## Commands

| Command         | What it does                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `typst:install` | Downloads the pinned binary, checksum-verified. Idempotent; never a postinstall.                                     |
| `typst:doctor`  | Checks binary, version, fonts and libraries. Exits non-zero — put it in the deploy pipeline.                         |
| `typst:preview` | Renders a template with real data to a file: `node ace typst:preview app/documents/one_pager.typ -d data.json --png` |

## Telemetry

Every compile is logged through the application logger by default. Set
`telemetry: false` to turn it off, or pass a function to route it elsewhere.

Watch `queuedMs` against `compileMs`: the first says the queue is the
bottleneck (raise `concurrency`, or move renders to a job queue), the second
says the documents themselves got heavier.

## The binary

`typst:install` downloads only versions and platforms whose checksum ships in
this package, verified against the official release. For anything else —
a newer Typst than this package knows, or a platform it does not list —
declare it yourself, and nothing is blocked waiting on a release here:

```ts
install: {
  url: 'https://github.com/typst/typst/releases/download/v0.16.0/typst-x86_64-unknown-linux-musl.tar.xz',
  sha256: '…',
}
```

## License

MIT
