import { EventEmitter } from 'node:events'

import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'

import { TypstUnavailableException } from '../src/errors.js'
import {
  handleTypstError,
  isRenderAborted,
  isTypstUnavailable,
  signalFromResponse,
} from '../src/http.js'

/** The slice of the response these helpers touch: the Node stream underneath. */
function fakeResponse() {
  const stream = new EventEmitter() as EventEmitter & { writableFinished: boolean }
  stream.writableFinished = false
  return {
    stream,
    response: { response: stream } as unknown as HttpContext['response'],
  }
}

function typstError(code: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(code), { code, ...extra })
}

test.group('signalFromResponse', () => {
  test('aborts when the connection drops mid-delivery', ({ assert }) => {
    const { stream, response } = fakeResponse()
    const signal = signalFromResponse(response)

    stream.writableFinished = false
    stream.emit('close')

    assert.isTrue(signal.aborted)
  })

  test('does not abort after a completed delivery', ({ assert }) => {
    const { stream, response } = fakeResponse()
    const signal = signalFromResponse(response)

    // `close` fires on success too — writableFinished is what tells them
    // apart. Without it every download would be logged as a client abort.
    stream.writableFinished = true
    stream.emit('close')

    assert.isFalse(signal.aborted)
  })
})

test.group('error predicates', () => {
  test('recognise the engine codes without instanceof', ({ assert }) => {
    assert.isTrue(isRenderAborted(typstError('E_TYPST_ABORTED')))
    assert.isFalse(isRenderAborted(typstError('E_TYPST_COMPILE')))
    assert.isTrue(isTypstUnavailable(typstError('E_TYPST_NOT_AVAILABLE')))
    assert.isFalse(isTypstUnavailable(new Error('boom')))
  })
})

test.group('handleTypstError', () => {
  test('answers 499 for a client that hung up', ({ assert }) => {
    let status: number | undefined
    const ctx = {
      response: { status: (code: number) => (status = code) },
    } as unknown as HttpContext

    const handled = handleTypstError(typstError('E_TYPST_ABORTED'), ctx)

    assert.isTrue(handled)
    assert.equal(status, 499)
  })

  test('raises a 503 naming the binary when it is missing', ({ assert }) => {
    const ctx = { response: { status: () => {} } } as unknown as HttpContext

    assert.throws(
      () => handleTypstError(typstError('E_TYPST_NOT_AVAILABLE', { bin: '/opt/typst' }), ctx),
      /\/opt\/typst/
    )
    try {
      handleTypstError(typstError('E_TYPST_NOT_AVAILABLE', { bin: '/opt/typst' }), ctx)
    } catch (error) {
      assert.instanceOf(error, TypstUnavailableException)
      assert.equal((error as TypstUnavailableException).status, 503)
    }
  })

  test('leaves anything else to the caller', ({ assert }) => {
    const ctx = { response: { status: () => {} } } as unknown as HttpContext

    assert.isFalse(handleTypstError(typstError('E_TYPST_COMPILE'), ctx))
    assert.isFalse(handleTypstError(new Error('unrelated'), ctx))
  })
})
