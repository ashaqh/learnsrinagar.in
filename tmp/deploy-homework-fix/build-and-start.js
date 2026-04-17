import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const buildDir = path.join(currentDir, 'build')

console.log('Building and starting Remix application...')

try {
  if (!existsSync(buildDir)) {
    console.log('Build directory not found. Running production build...')
    execSync('npm run build', { stdio: 'inherit' })
  }

  console.log('Starting application...')
  execSync('npm start', { stdio: 'inherit' })
} catch (error) {
  console.error('Startup error:', error.message)
  process.exit(1)
}
