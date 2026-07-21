import type { HttpContext } from '@adonisjs/core/http'

import { TypstUnavailableException } from './errors.js'

/**
 * Matching on `code` rather than `instanceof`: the code that asks is the
 * exception handler, which should not have to import the rendering engine
 * to recognise a request outcome — and a duplicated copy of the package in
 * the dependency tree breaks `instanceof` silently.
 */
function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

/** Whether this failure is the caller's own cancellation. */
export function isRenderAborted(error: unknown): boolean {
  return hasCode(error, 'E_TYPST_ABORTED')
}

/** Whether this failure is a missing Typst binary. */
export function isTypstUnavailable(error: unknown): boolean {
  return hasCode(error, 'E_TYPST_NOT_AVAILABLE')
}

/**
 * An `AbortSignal` that fires when the client gives up on the download.
 *
 * `close` fires on *both* outcomes — a dropped connection and a completed
 * delivery — so `writableFinished` breaks the tie. Without it every
 * successful download is recorded as a client abort, and your cancellation
 * metrics describe a problem that is not happening.
 *
 * @example
 * const pdf = await typst.compile({ template, data, signal: signalFromResponse(response) })
 */
export function signalFromResponse(response: HttpContext['response']): AbortSignal {
  const controller = new AbortController()

  response.response.once('close', () => {
    if (!response.response.writableFinished) controller.abort()
  })

  return controller.signal
}

/**
 * Maps a render failure to the right HTTP outcome, returning whether it
 * handled it. Both decisions it encodes are counter-intuitive enough to be
 * worth having in one place:
 *
 * - **an abort is not a server error.** The client hung up; a 500 would page
 *   somebody over a closed tab. It answers 499 and reports nothing.
 * - **a missing binary is not a request error.** Nothing the caller sent is
 *   wrong — the host is not provisioned. It raises a 503 naming the path, so
 *   the fix lands with ops instead of in a stack trace.
 *
 * Anything else is not this function's business and comes back `false`.
 *
 * @example
 * try { ... } catch (error) {
 *   if (handleTypstError(error, ctx)) return
 *   throw error
 * }
 */
export function handleTypstError(error: unknown, ctx: HttpContext): boolean {
  if (isRenderAborted(error)) {
    ctx.response.status(499)
    return true
  }

  if (isTypstUnavailable(error)) {
    const bin = error instanceof Error && 'bin' in error ? String(error.bin) : 'the configured path'
    throw new TypstUnavailableException(bin)
  }

  return false
}
