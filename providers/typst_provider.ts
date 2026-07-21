import type { ApplicationService } from '@adonisjs/core/types'
import { RuntimeException } from '@poppinss/utils'
import { TypstRenderer } from 'typst-report'
import type { RenderEvent } from 'typst-report'

import { TypstManager, toRendererOptions } from '../src/manager.js'
import type { TypstConfig } from '../src/types.js'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    'typst.manager': TypstManager
  }
}

export default class TypstProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('typst.manager', async () => {
      const config = this.app.config.get<TypstConfig | undefined>('typst')
      if (!config || typeof config.bin !== 'string') {
        throw new RuntimeException(
          'Invalid config exported from "config/typst.ts". Make sure to use the defineConfig method.'
        )
      }

      const logger = await this.app.container.make('logger')
      const telemetry = config.telemetry ?? true
      const onRender: ((event: RenderEvent) => void) | undefined =
        telemetry === false
          ? undefined
          : typeof telemetry === 'function'
            ? telemetry
            : (event) => logger.info({ typst: event }, 'typst render')

      return new TypstManager(config, new TypstRenderer(toRendererOptions(config, onRender)))
    })
  }
}
