import { Exception } from '@adonisjs/core/exceptions'

/**
 * The Typst binary is missing from the configured path.
 *
 * A 503 rather than a 500: nothing about the request is wrong, the host is
 * not provisioned (`typst:install` never ran). Hiding the download buttons
 * instead would mean probing the filesystem on every render.
 */
export class TypstUnavailableException extends Exception {
  static status = 503
  static code = 'E_TYPST_UNAVAILABLE'

  constructor(bin: string) {
    super(`Typst binary not found at ${bin}; run \`node ace typst:install\`.`)
  }
}
