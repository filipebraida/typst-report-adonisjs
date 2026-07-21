import { test } from '@japa/runner'
import { FakeRenderer } from 'typst-report/testing'

import { TypstManager, toRendererOptions } from '../src/manager.js'
import type { TypstConfig } from '../src/types.js'

const config: TypstConfig = {
  bin: '/opt/typst',
  version: '0.15.1',
  fonts: ['Lato'],
}

test.group('TypstManager', () => {
  test('delegates compiles to the real renderer', async ({ assert }) => {
    const real = new FakeRenderer({ pdf: Buffer.from('%PDF real') })
    const manager = new TypstManager(config, real)

    const pdf = await manager.compile({ source: 'x', data: { a: 1 } })

    assert.equal(pdf.toString(), '%PDF real')
    assert.lengthOf(real.renders, 1)
  })

  test('fake() intercepts compiles and restore() puts the real one back', async ({ assert }) => {
    const real = new FakeRenderer({ pdf: Buffer.from('%PDF real') })
    const manager = new TypstManager(config, real)

    const fake = manager.fake({ pdf: Buffer.from('%PDF fake') })
    const intercepted = await manager.compile({ source: 'x', data: {} })

    assert.isTrue(manager.isFake)
    assert.equal(intercepted.toString(), '%PDF fake')
    assert.lengthOf(fake.renders, 1)
    // The real renderer never saw it.
    assert.lengthOf(real.renders, 0)

    manager.restore()
    const direct = await manager.compile({ source: 'x', data: {} })

    assert.isFalse(manager.isFake)
    assert.equal(direct.toString(), '%PDF real')
    assert.lengthOf(real.renders, 1)
  })

  test('records the view model that reached the template', async ({ assert }) => {
    const manager = new TypstManager(config, new FakeRenderer())
    const fake = manager.fake()

    await manager.compile({ template: '/app/one_pager.typ', data: { title: 'Hello' } })

    assert.deepEqual(fake.lastRender?.data, { title: 'Hello' })
    assert.equal(fake.lastRender?.template, '/app/one_pager.typ')
  })

  test('check() with no arguments asserts what the config declared', async ({ assert }) => {
    const manager = new TypstManager(
      config,
      new FakeRenderer({ version: '0.15.1', fonts: ['Lato'] })
    )

    const diagnosis = await manager.check()

    assert.isTrue(diagnosis.ok)
    assert.equal(diagnosis.version?.expected, '0.15.1')
    assert.deepEqual(diagnosis.fonts?.missing, [])
  })

  test('check() reports a version the config did not expect', async ({ assert }) => {
    const manager = new TypstManager(
      config,
      new FakeRenderer({ version: '0.14.0', fonts: ['Lato'] })
    )

    const diagnosis = await manager.check()

    assert.isFalse(diagnosis.ok)
    assert.equal(diagnosis.version?.actual, '0.14.0')
  })

  test('a config without expectations checks nothing beyond the binary', async ({ assert }) => {
    const manager = new TypstManager({ bin: '/opt/typst' }, new FakeRenderer())

    const diagnosis = await manager.check()

    assert.isUndefined(diagnosis.version)
    assert.isUndefined(diagnosis.fonts)
  })
})

test.group('toRendererOptions', () => {
  test('passes through only what was configured', ({ assert }) => {
    const options = toRendererOptions({ bin: '/opt/typst', concurrency: 4 })

    assert.deepEqual(options, { bin: '/opt/typst', concurrency: 4 })
  })

  test('wires the telemetry callback when given', ({ assert }) => {
    const options = toRendererOptions({ bin: '/opt/typst' }, () => {})

    assert.isFunction(options.onRender)
  })
})
