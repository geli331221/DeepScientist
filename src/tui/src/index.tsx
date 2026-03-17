import React from 'react'
import { render } from 'ink'

import { AppContainer } from './app/AppContainer.js'
import { isAlternateBufferEnabled, isIncrementalRenderingEnabled } from './utils/terminal.js'

const CLEAR_TO_END = '\x1b[0K'

const withLineClearing = (stdout: NodeJS.WriteStream): NodeJS.WriteStream => {
  const transform = (chunk: unknown) => {
    const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
    if (!text) return text
    const cleared = text.replace(/\r?\n/g, (match) => `${CLEAR_TO_END}${match}`)
    return cleared.endsWith('\n') ? cleared : `${cleared}${CLEAR_TO_END}`
  }

  return new Proxy(stdout, {
    get(target, prop, receiver) {
      if (prop === 'write') {
        return (chunk: unknown, encoding?: unknown, callback?: unknown) =>
          (target as typeof stdout).write(transform(chunk), encoding as BufferEncoding, callback as () => void)
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as NodeJS.WriteStream
}

function parseArg(name: string): string | null {
  const index = process.argv.indexOf(name)
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1] ?? null
  }
  return null
}

const baseUrl = parseArg('--base-url') ?? 'http://0.0.0.0:20999'
const questId = parseArg('--quest-id')

const useAlternateBuffer = isAlternateBufferEnabled()
const useIncrementalRendering = isIncrementalRenderingEnabled()

render(<AppContainer baseUrl={baseUrl} initialQuestId={questId} />, {
  stdout: withLineClearing(process.stdout),
  stderr: process.stderr,
  stdin: process.stdin,
  exitOnCtrlC: false,
  patchConsole: false,
  alternateBuffer: useAlternateBuffer,
  incrementalRendering: useIncrementalRendering,
})
