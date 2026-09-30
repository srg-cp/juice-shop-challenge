import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { normalizeTarget, runSolver, validateQuotas, inspectTarget } from '../src/engine.js'

const quota = changes => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, ...changes })

test('acepta dominios e IP con puertos y aplica allowlist opcional', () => {
  assert.equal(normalizeTarget('http://192.30.108.73:3001/'), 'http://192.30.108.73:3001')
  assert.equal(normalizeTarget('https://juice.kormind.com/', 'https://juice.kormind.com'), 'https://juice.kormind.com')
  assert.throws(() => normalizeTarget('file:///etc/passwd'))
  assert.throws(() => normalizeTarget('http://other.test/', 'https://juice.kormind.com'))
})

test('valida límite total y límite de nivel 3', () => {
  assert.deepEqual(validateQuotas(quota({ 1: 2, 3: 4 })), quota({ 1: 2, 3: 4 }))
  assert.throws(() => validateQuotas(quota({ 1: 41 })))
  assert.throws(() => validateQuotas(quota({ 3: 9 })))
  assert.throws(() => validateQuotas(quota({})))
})

test('cuenta solo retos que cambiaron a resueltos', async () => {
  let solved = false
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/Challenges') return res.end(JSON.stringify({ data: [{ key: 'directoryListingChallenge', name: 'Confidential Document', difficulty: 1, solved }] }))
    if (req.url === '/ftp/acquisitions.md') { solved = true; return res.end('{}') }
    res.statusCode = 404; res.end('{}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const report = await runSolver(`http://127.0.0.1:${server.address().port}`, quota({ 1: 1 }))
    assert.equal(report.status, 'completed')
    assert.equal(report.newSolved, 1)
    assert.equal(report.achieved[1], 1)
    assert.deepEqual(report.solved.map(x => x.key), ['directoryListingChallenge'])
  } finally { await new Promise(resolve => server.close(resolve)) }
})

test('solo ejecuta los niveles pedidos y muestra disponibilidad', async () => {
  let levelOneCalls = 0, levelTwoSolved = false
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/Challenges') return res.end(JSON.stringify({ data: [
      { key: 'directoryListingChallenge', name: 'Confidential Document', difficulty: 1, solved: false },
      { key: 'securityPolicyChallenge', name: 'Security Policy', difficulty: 2, solved: levelTwoSolved }
    ] }))
    if (req.url === '/ftp/acquisitions.md') levelOneCalls++
    if (req.url === '/.well-known/security.txt') levelTwoSolved = true
    res.end('{}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const origin = `http://127.0.0.1:${server.address().port}`
    const preview = await inspectTarget(origin)
    assert.equal(preview.supported[1], 1)
    assert.equal(preview.supported[2], 1)
    const report = await runSolver(origin, quota({ 2: 1 }))
    assert.equal(report.status, 'completed')
    assert.equal(report.achieved[2], 1)
    assert.equal(report.achieved[1], 0)
    assert.equal(levelOneCalls, 0)
  } finally { await new Promise(resolve => server.close(resolve)) }
})

test('separa los retos incidentales fuera de la cuota', async () => {
  let solved = false
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/Challenges') return res.end(JSON.stringify({ data: [
      { key: 'directoryListingChallenge', name: 'Document', difficulty: 1, solved },
      { key: 'securityPolicyChallenge', name: 'Policy', difficulty: 2, solved }
    ] }))
    if (req.url === '/ftp/acquisitions.md') solved = true
    res.end('{}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const report = await runSolver(`http://127.0.0.1:${server.address().port}`, quota({ 1: 1 }))
    assert.equal(report.status, 'completed')
    assert.equal(report.newSolved, 2)
    assert.equal(report.achieved[1], 1)
    assert.equal(report.achieved[2], 0)
    assert.equal(report.extraSolved, 1)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
