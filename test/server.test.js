import test from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from '../src/server.js'

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
