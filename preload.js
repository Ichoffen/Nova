const { contextBridge } = require('electron');

// На будущее, если понадобится IPC
contextBridge.exposeInMainWorld('nova', {
  // методы можно будет добавить здесь
});
