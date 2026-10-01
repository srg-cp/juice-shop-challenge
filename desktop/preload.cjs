const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  getToken: () => ipcRenderer.invoke('solver-token')
})
