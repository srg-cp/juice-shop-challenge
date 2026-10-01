import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { startServer } from '../src/server.js'
import { startLocalServer } from '../src/local-server.js'

test('servidor local usa loopback, puerto libre y exige token para la API', async () => {
  const token = 'a'.repeat(32)
  const server = await startServer({ token, host: '127.0.0.1', port: 0 })
  try {
    assert.equal(server.address().address, '127.0.0.1')
    const origin = `http://127.0.0.1:${server.address().port}`
    const home = await fetch(origin)
    assert.equal(home.status, 200)
    assert.match(await home.text(), /Juice Shop Solver/)
    const unauthorized = await fetch(`${origin}/api/steps`)
    assert.equal(unauthorized.status, 401)
    const authorized = await fetch(`${origin}/api/steps`, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(authorized.status, 200)
    assert.ok((await authorized.json()).length > 0)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('modo local entrega el token solo en la página local y usa otro puerto si el preferido está ocupado', async () => {
  const blocker = http.createServer((_req, res) => res.end('busy'))
  await new Promise(resolve => blocker.listen(0, '127.0.0.1', resolve))
  const token = 'b'.repeat(32)
  let server
  try {
    server = await startLocalServer(token, blocker.address().port)
    assert.equal(server.address().address, '127.0.0.1')
    assert.notEqual(server.address().port, blocker.address().port)
    const origin = `http://127.0.0.1:${server.address().port}`
    const config = await fetch(`${origin}/local-config.js`)
    assert.equal(config.status, 200)
    assert.match(await config.text(), new RegExp(token))
    const wrongHost = await new Promise((resolve, reject) => {
      http.get(origin, { headers: { Host: 'other.example' } }, response => {
        response.resume()
        response.on('end', () => resolve(response.statusCode))
      }).on('error', reject)
    })
    assert.equal(wrongHost, 403)
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    await new Promise(resolve => blocker.close(resolve))
  }
})
