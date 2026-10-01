import { startServer } from './server.js'

export async function startLocalServer(token, preferredPort = 4173) {
  try {
    return await startServer({ token, port: preferredPort, host: '127.0.0.1', localMode: true })
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error
    return startServer({ token, port: 0, host: '127.0.0.1', localMode: true })
  }
}
