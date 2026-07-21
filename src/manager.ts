import { TypstRenderer } from 'typst-report'
import type {
  CheckOptions,
  CheckResult,
  CompileInput,
  CompileInputWithFormat,
  DocumentFormat,
  OutputFormat,
  PagedFormat,
  RenderEvent,
  Renderer,
  RendererOptions,
} from 'typst-report'
import { FakeRenderer } from 'typst-report/testing'
import type { FakeRendererOptions } from 'typst-report/testing'

import type { TypstConfig } from './types.js'

/** Translates the application's config into engine options. */
export function toRendererOptions(
  config: TypstConfig,
  onRender?: (event: RenderEvent) => void
): RendererOptions {
  return {
    bin: config.bin,
    ...(config.fontPath === undefined ? {} : { fontPath: config.fontPath }),
    ...(config.libraries === undefined ? {} : { libraries: config.libraries }),
    ...(config.ignoreSystemFonts === undefined
      ? {}
      : { ignoreSystemFonts: config.ignoreSystemFonts }),
    ...(config.packagePath === undefined ? {} : { packagePath: config.packagePath }),
    ...(config.packageCachePath === undefined ? {} : { packageCachePath: config.packageCachePath }),
    ...(config.concurrency === undefined ? {} : { concurrency: config.concurrency }),
    ...(config.timeoutMs === undefined ? {} : { timeoutMs: config.timeoutMs }),
    ...(onRender === undefined ? {} : { onRender }),
  }
}

/**
 * The renderer as the application sees it: one instance for the process,
 * swappable for a fake in tests.
 *
 * One instance matters — the engine's concurrency gate lives in the
 * renderer, so a renderer built per request would quietly stop capping
 * anything. Binding it in the container removes the opportunity.
 */
export class TypstManager implements Renderer {
  readonly #config: TypstConfig
  readonly #real: Renderer
  #fake: FakeRenderer | undefined

  constructor(config: TypstConfig, real?: Renderer) {
    this.#config = config
    this.#real = real ?? new TypstRenderer(toRendererOptions(config))
  }

  /** Whichever renderer is answering right now. */
  get #active(): Renderer {
    return this.#fake ?? this.#real
  }

  /** Whether a fake is currently installed. */
  get isFake(): boolean {
    return this.#fake !== undefined
  }

  compile<TData>(input: CompileInput<TData> & { format?: DocumentFormat }): Promise<Buffer>
  compile<TData>(input: CompileInputWithFormat<TData, PagedFormat>): Promise<Buffer[]>
  compile<TData>(
    input: CompileInput<TData> & { format?: OutputFormat }
  ): Promise<Buffer | Buffer[]> {
    const active = this.#active as {
      compile(input: CompileInput<TData> & { format?: OutputFormat }): Promise<Buffer | Buffer[]>
    }
    return active.compile(input)
  }

  eval<TResult = unknown, TData = unknown>(
    input: CompileInput<TData>,
    expression: string
  ): Promise<TResult> {
    return this.#active.eval<TResult, TData>(input, expression)
  }

  version(): Promise<string> {
    return this.#active.version()
  }

  fonts(): Promise<string[]> {
    return this.#active.fonts()
  }

  /**
   * Diagnoses the environment. With no arguments it asserts what
   * `config/typst.ts` declared — which is what makes `typst:doctor` a
   * one-liner.
   */
  check(expectations?: CheckOptions): Promise<CheckResult> {
    return this.#active.check(expectations ?? this.configuredExpectations())
  }

  /** The expectations declared in config, in the engine's shape. */
  configuredExpectations(): CheckOptions {
    return {
      ...(this.#config.version === undefined ? {} : { version: this.#config.version }),
      ...(this.#config.fonts === undefined ? {} : { fonts: this.#config.fonts }),
    }
  }

  /**
   * Swaps in a recording fake for the rest of the test. Endpoint specs then
   * assert the view model that reached the template — and keep running on
   * machines with no Typst binary.
   */
  fake(options?: FakeRendererOptions): FakeRenderer {
    this.#fake = new FakeRenderer(options)
    return this.#fake
  }

  /** Puts the real renderer back — for teardown, or for a spec that compiles. */
  restore(): void {
    this.#fake = undefined
  }
}
