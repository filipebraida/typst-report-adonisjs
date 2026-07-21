import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './index.ts',
    './configure.ts',
    './services/typst.ts',
    './providers/typst_provider.ts',
    './src/types.ts',
    './src/http.ts',
    './stubs/main.ts',
    './commands/main.ts',
    './commands/typst_install.ts',
    './commands/typst_doctor.ts',
    './commands/typst_preview.ts',
  ],
  outDir: './build',
  unbundle: true,
  clean: true,
  format: 'esm',
  minify: 'dce-only',
  fixedExtension: false,
  dts: false,
  treeshake: false,
  target: 'esnext',
})
