import { app, BrowserWindow, ipcMain, session } from 'electron'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { startServer } from '../src/server.js'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let window
  let server
  const token = randomBytes(32).toString('hex')

  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  app.whenReady().then(async () => {
    try {
      process.env.SOLVER_BROWSER_CHANNEL = 'msedge'
      server = await startServer({ token, host: '127.0.0.1', port: 0 })
      const origin = `http://127.0.0.1:${server.address().port}`
      session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
      window = new BrowserWindow({
        width: 1100,
        height: 850,
        minWidth: 720,
        minHeight: 600,
        title: 'Juice Shop Solver',
        webPreferences: {
          preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      })
      ipcMain.handle('solver-token', event => {
        if (event.sender !== window?.webContents || event.sender.getURL() !== `${origin}/`) throw new Error('Origen inválido')
        return token
      })
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      window.webContents.on('will-navigate', (event, url) => {
        if (url !== `${origin}/`) event.preventDefault()
      })
      await window.loadURL(origin)
    } catch (error) {
      console.error(error)
      app.quit()
    }
  })

  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => server?.close())
}
