import type { FileSource, RenderEvent } from 'typst-report'

/**
 * Everything the application declares about its rendering environment —
 * runtime parameters *and* expectations. The expectations are what turn
 * `typst:doctor` into a one-line deploy gate.
 */
export interface TypstConfig {
  /** Path to the `typst` executable. `typst:install` writes it here. */
  bin: string

  /**
   * The pinned Typst version. Typst is pre-1.0 and its layout changes
   * between minors, so every template is a validated visual snapshot:
   * `typst:install` downloads exactly this version and `typst:doctor`
   * refuses anything else.
   */
  version?: string

  /** Font families the templates name. Missing ones fall back silently in Typst — `typst:doctor` catches that. */
  fonts?: string[]

  /** Passed as `--font-path`. */
  fontPath?: string

  /** Libraries placed into every compile, keyed by the path templates import. */
  libraries?: Record<string, FileSource>

  /** Passed as `--ignore-system-fonts`. Defaults to true (reproducibility). */
  ignoreSystemFonts?: boolean

  /** Passed as `--package-path` / `--package-cache-path`. */
  packagePath?: string
  packageCachePath?: string

  /** Compiles allowed at once in this process. Defaults to 1. */
  concurrency?: number

  /** Hard ceiling per compile. Defaults to the engine's 15s. */
  timeoutMs?: number

  /**
   * Where `typst:install` fetches the binary from, when `version` is not in
   * the bundled table (a Typst release newer than this package, or a
   * platform it does not list). Supplying it is always allowed — the table
   * is a convenience, never a gate.
   */
  install?: BinaryRelease

  /**
   * Render telemetry. `true` (the default) logs every compile through the
   * application logger; a function receives the event instead; `false`
   * disables it.
   *
   * The number worth watching is `queuedMs` against `compileMs`: the first
   * says the queue is the bottleneck (raise `concurrency`, or move renders
   * to a job queue), the second says the documents got heavier.
   */
  telemetry?: boolean | ((event: RenderEvent) => void)
}

/** A downloadable Typst binary, pinned by hash. */
export interface BinaryRelease {
  url: string
  /** sha256 of the archive, checked before anything is unpacked. */
  sha256: string
  /** Directory inside the archive holding the `typst` executable. */
  archiveDir?: string
}
