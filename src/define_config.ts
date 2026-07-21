import type { TypstConfig } from './types.js'

/**
 * Declares the rendering environment in `config/typst.ts`.
 *
 * Identity at runtime — its job is to type the object and to give the
 * provider a single shape to read.
 */
export function defineConfig(config: TypstConfig): TypstConfig {
  return config
}
