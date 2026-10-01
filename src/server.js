import http from 'node:http'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { normalizeTarget, runSolver, availableSteps, inspectTarget, validateQuotas } from './engine.js'

const html = await readFile(fileURLToPath(new URL('./index.html', import.meta.url)))

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}
function authorized(req, token) {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
  if (!bearer) return false
  const a = Buffer.from(bearer), b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}
async function bodyJson(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 4096) throw new Error('Solicitud demasiado grande')
  }
  try { return JSON.parse(raw) } catch { throw new Error('JSON inválido') }
}

export function startServer({ token, port = 3000, host = '0.0.0.0', allowedTargets = '', localMode = false }) {
  if (!token || token.length < 24) throw new Error('Define API_TOKEN con al menos 24 caracteres')
  const jobs = new Map()
  let active = null
  const server = http.createServer(async (req, res) => {
  try {
    if (localMode && ![`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`].includes(req.headers.host)) {
      return send(res, 403, { error: 'Host local inválido' })
    }
    const path = new URL(req.url, 'http://localhost').pathname
    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true })
    if (req.method === 'GET' && path === '/') return send(res, 200, html, 'text/html; charset=utf-8')
    if (req.method === 'GET' && path === '/local-config.js') return send(res, 200, localMode ? `window.localSolver = { token: ${JSON.stringify(token)} }` : '', 'application/javascript; charset=utf-8')
    if (req.method === 'GET' && path === '/app.js') return send(res, 200, await readFile(fileURLToPath(new URL('./app.js', import.meta.url))), 'application/javascript; charset=utf-8')
    if (!authorized(req, token)) return send(res, 401, { error: 'Token inválido o ausente' })
    if (req.method === 'GET' && path === '/api/steps') return send(res, 200, availableSteps)
    if (req.method === 'POST' && path === '/api/targets/inspect') {
      const input = await bodyJson(req)
      const target = normalizeTarget(input.url, allowedTargets)
      return send(res, 200, await inspectTarget(target))
    }
    if (req.method === 'POST' && path === '/api/runs') {
      if (active) return send(res, 409, { error: 'Ya hay una ejecución activa' })
      const input = await bodyJson(req)
      const target = normalizeTarget(input.url, allowedTargets)
      const quotas = validateQuotas(input.quotas)
      const count = Object.values(quotas).reduce((sum, n) => sum + n, 0)
      const id = randomUUID()
      const job = { id, target, quotas, requested: count, status: 'queued', initialSolved: 0, newSolved: 0, achieved: {}, solved: [], attempts: [], createdAt: new Date().toISOString() }
      jobs.set(id, job)
      active = id
      setImmediate(async () => {
        try { await runSolver(target, quotas, update => Object.assign(job, structuredClone(update))) }
        catch (e) { job.status = 'failed'; job.error = String(e.message || e) }
        finally { job.finishedAt = new Date().toISOString(); active = null }
      })
      return send(res, 202, { id, status: job.status })
    }
    if (req.method === 'GET' && path.startsWith('/api/runs/')) {
      const job = jobs.get(path.split('/')[3])
      return job ? send(res, 200, job) : send(res, 404, { error: 'Ejecución no encontrada' })
    }
    return send(res, 404, { error: 'Ruta no encontrada' })
  } catch (e) { return send(res, 400, { error: String(e.message || e) }) }
  })
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, host, () => {
      server.off('error', rejectListen)
      resolveListen(server)
    })
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer({
    token: process.env.API_TOKEN,
    port: Number(process.env.PORT || 3000),
    host: process.env.HOST || '0.0.0.0',
    allowedTargets: process.env.ALLOWED_TARGETS || ''
  })
  console.log(`Juice Shop solver listening on ${server.address().address}:${server.address().port}`)
}
