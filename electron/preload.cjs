const { contextBridge, ipcRenderer } = require('electron')

// Puente mínimo y explícito entre la ventana y el sistema de archivos / red local
contextBridge.exposeInMainWorld('escritorio', {
  respaldo: {
    carpeta: () => ipcRenderer.invoke('respaldo:carpeta'),
    sugerida: () => ipcRenderer.invoke('respaldo:sugerida'),
    usar: (carpeta) => ipcRenderer.invoke('respaldo:usar', carpeta),
    elegir: () => ipcRenderer.invoke('respaldo:elegir'),
    escribir: (rel, datos) => ipcRenderer.invoke('respaldo:escribir', rel, datos),
    leer: (rel) => ipcRenderer.invoke('respaldo:leer', rel),
    rotar: (rel, conservar) => ipcRenderer.invoke('respaldo:rotar', rel, conservar),
    abrir: () => ipcRenderer.invoke('respaldo:abrir'),
  },
  sync: {
    iniciar: (origenes) => ipcRenderer.invoke('sync:iniciar', origenes),
    detener: () => ipcRenderer.invoke('sync:detener'),
    responder: (r) => ipcRenderer.invoke('sync:respuesta', r),
    alSolicitar: (fn) => {
      const h = (_e, d) => fn(d)
      ipcRenderer.on('sync:solicitud', h)
      return () => ipcRenderer.removeListener('sync:solicitud', h)
    },
    alEvento: (fn) => {
      const h = (_e, d) => fn(d)
      ipcRenderer.on('sync:evento', h)
      return () => ipcRenderer.removeListener('sync:evento', h)
    },
  },
})
