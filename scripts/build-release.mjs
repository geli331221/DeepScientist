#!/usr/bin/env node

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function ensureFile(relativePath) {
  const fullPath = path.join(repoRoot, relativePath)
  if (!existsSync(fullPath)) {
    console.error(`Missing required release artifact: ${relativePath}`)
    process.exit(1)
  }
}

run('npm', ['--prefix', 'src/ui', 'install', '--include=dev', '--no-audit', '--no-fund'])
run('npm', ['--prefix', 'src/ui', 'run', 'build'])
run('npm', ['--prefix', 'src/tui', 'install', '--include=dev', '--no-audit', '--no-fund'])
run('npm', ['--prefix', 'src/tui', 'run', 'build'])

ensureFile('src/ui/dist/index.html')
ensureFile('src/tui/dist/index.js')
