import http from 'node:http'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { normalizeTarget, runSolver, availableSteps, inspectTarget, validateQuotas } from './engine.js'

const port = Number(process.env.PORT || 3000)
const token = process.env.API_TOKEN
if (!token || token.length < 24) throw new Error('Define API_TOKEN con al menos 24 caracteres')
const jobs = new Map()
let active = null
const html = await readFile(fileURLToPath(new URL('./index.html', import.meta.url)))

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}
function authorized(req) {
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

const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname
    if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true })
    if (req.method === 'GET' && path === '/') return send(res, 200, html, 'text/html; charset=utf-8')
    if (req.method === 'GET' && path === '/app.js') return send(res, 200, await readFile(fileURLToPath(new URL('./app.js', import.meta.url))), 'application/javascript; charset=utf-8')
    if (!authorized(req)) return send(res, 401, { error: 'Token inválido o ausente' })
    if (req.method === 'GET' && path === '/api/steps') return send(res, 200, availableSteps)
    if (req.method === 'POST' && path === '/api/targets/inspect') {
      const input = await bodyJson(req)
      const target = normalizeTarget(input.url, process.env.ALLOWED_TARGETS || '')
      return send(res, 200, await inspectTarget(target))
    }
    if (req.method === 'POST' && path === '/api/runs') {
      if (active) return send(res, 409, { error: 'Ya hay una ejecución activa' })
      const input = await bodyJson(req)
      const target = normalizeTarget(input.url, process.env.ALLOWED_TARGETS || '')
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
server.listen(port, '0.0.0.0', () => console.log(`Juice Shop solver listening on ${port}`))
