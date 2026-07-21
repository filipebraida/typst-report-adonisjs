import app from '@adonisjs/core/services/app'

import type { TypstManager } from '../src/manager.js'

let typst: TypstManager

await app.booted(async () => {
  typst = await app.container.make('typst.manager')
})

export { typst as default }
