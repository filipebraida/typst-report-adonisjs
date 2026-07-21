import { readFile, writeFile } from 'node:fs/promises'

export type PatchOutcome = 'added' | 'already-present' | 'file-missing'

/**
 * Appends a block to a plain text file, once.
 *
 * `marker` is what identifies the block as already applied, so re-running
 * `configure` on a project cannot duplicate it. Used for the files
 * AdonisJS has no codemod for — .gitignore and .env.example — where the
 * alternative is asking every consumer to remember the same two edits.
 */
export async function ensureLines(
  filePath: string,
  marker: string,
  block: string
): Promise<PatchOutcome> {
  let contents: string
  try {
    contents = await readFile(filePath, 'utf8')
  } catch {
    // A project without the file is not a project to repair — say so and
    // let the caller decide whether that is worth a warning.
    return 'file-missing'
  }

  if (contents.includes(marker)) return 'already-present'

  const separator = contents.endsWith('\n') || contents.length === 0 ? '' : '\n'
  await writeFile(filePath, `${contents}${separator}${block.trimEnd()}\n`, 'utf8')
  return 'added'
}
