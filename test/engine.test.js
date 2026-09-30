import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { normalizeTarget, runSolver } from '../src/engine.js'

test('acepta dominios e IP con puertos y aplica allowlist opcional', () => {
  assert.equal(normalizeTarget('http://192.30.108.73:3001/'), 'http://192.30.108.73:3001')
  assert.equal(normalizeTarget('https://juice.kormind.com/', 'https://juice.kormind.com'), 'https://juice.kormind.com')
  assert.throws(() => normalizeTarget('file:///etc/passwd'))
  assert.throws(() => normalizeTarget('http://other.test/', 'https://juice.kormind.com'))
})

test('cuenta solo retos que cambiaron a resueltos', async () => {
  let solved = false
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/Challenges') return res.end(JSON.stringify({ data: [{ key: 'directoryListingChallenge', name: 'Confidential Document', solved }] }))
    if (req.url === '/ftp/acquisitions.md') { solved = true; return res.end('{}') }
    res.statusCode = 404; res.end('{}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const report = await runSolver(`http://127.0.0.1:${server.address().port}`, 1)
    assert.equal(report.status, 'completed')
    assert.equal(report.newSolved, 1)
    assert.deepEqual(report.solved.map(x => x.key), ['directoryListingChallenge'])
  } finally { await new Promise(resolve => server.close(resolve)) }
})
