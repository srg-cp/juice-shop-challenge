import { app, dialog, Menu, nativeImage, shell, Tray } from 'electron'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { startLocalServer } from '../src/local-server.js'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let server
  let tray
  let pageUrl

  const openPage = () => {
    if (pageUrl) shell.openExternal(pageUrl).catch(error => dialog.showErrorBox('No se pudo abrir el navegador', String(error)))
  }

  app.on('second-instance', openPage)
  app.on('activate', openPage)

  app.whenReady().then(async () => {
    try {
      process.env.SOLVER_BROWSER_CHANNEL = 'msedge'
      const token = randomBytes(32).toString('hex')
      server = await startLocalServer(token)
      pageUrl = `http://127.0.0.1:${server.address().port}/`

      const icon = nativeImage.createFromBuffer(await readFile(fileURLToPath(new URL('./tray.png', import.meta.url))))
      tray = new Tray(icon)
      tray.setToolTip(`Juice Shop Solver · ${pageUrl}`)
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Abrir Juice Shop Solver', click: openPage },
        { label: 'Salir', click: () => app.quit() }
      ]))
      tray.on('double-click', openPage)

      openPage()
    } catch (error) {
      dialog.showErrorBox('No se pudo iniciar Juice Shop Solver', String(error))
      app.quit()
    }
  })

  app.on('before-quit', () => server?.close())
}
