const { execSync } = require('node:child_process')

const serviceNames = ['MySQL80', 'MySQL', 'mysql']

function run(command) {
  return execSync(command, { stdio: 'pipe', encoding: 'utf8' })
}

function tryStartService(name) {
  try {
    run(`powershell -NoProfile -Command "Get-Service -Name '${name}' -ErrorAction Stop | Out-Null"`)
  } catch {
    return { ok: false, exists: false }
  }

  try {
    const status = run(
      `powershell -NoProfile -Command "(Get-Service -Name '${name}').Status.ToString()"`,
    ).trim()
    if (status.toLowerCase() === 'running') {
      return { ok: true, exists: true, alreadyRunning: true }
    }
  } catch {
    // Continue and attempt start anyway.
  }

  try {
    run(`powershell -NoProfile -Command "Start-Service -Name '${name}' -ErrorAction Stop"`)
    return { ok: true, exists: true, alreadyRunning: false }
  } catch (error) {
    return {
      ok: false,
      exists: true,
      error:
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Failed to start service.',
    }
  }
}

for (const service of serviceNames) {
  const result = tryStartService(service)
  if (!result.exists) continue
  if (result.ok) {
    const msg = result.alreadyRunning ? 'already running' : 'started'
    console.info(`[dev] MySQL service '${service}' ${msg}.`)
    process.exit(0)
  }
  console.warn(`[dev] Found MySQL service '${service}', but could not start it automatically.`)
  console.warn('[dev] Run terminal as Administrator or start MySQL manually, then re-run dev.')
  process.exit(0)
}

console.info('[dev] MySQL Windows service not found; skipping auto-start.')
console.info('[dev] If MySQL is not running, start it manually and keep DB_USER/DB_PASSWORD in server/.env.')
