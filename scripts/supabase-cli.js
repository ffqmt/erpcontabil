#!/usr/bin/env node

const { spawnSync } = require('child_process')
const path = require('path')

process.env.POSTHOG_DISABLED = 'true'
process.env.PATH = `${path.join(process.cwd(), 'node_modules', '.bin')}${path.delimiter}${process.env.PATH || ''}`

const command = 'supabase'
const result = spawnSync(command, process.argv.slice(2), {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32'
})

if (result.error) {
  console.error(result.error.message)
}

process.exit(result.status ?? 1)
