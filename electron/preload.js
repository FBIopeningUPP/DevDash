const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, secure API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => process.env.npm_package_version || '2.0.0',
  platform: process.platform,

  // Check if running inside Electron
  isElectron: true,
});
