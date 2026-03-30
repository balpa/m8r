const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('m8r', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  getTheme: () => ipcRenderer.invoke('get-theme'),

  startAuth: () => ipcRenderer.invoke('start-auth'),
  disconnect: () => ipcRenderer.invoke('disconnect-account'),
  togglePin: () => ipcRenderer.invoke('toggle-pin'),

  resizeToFit: (h) => ipcRenderer.send('resize-to-fit', h),
  openUsagePage: () => ipcRenderer.send('open-usage-page'),
  refreshData: () => ipcRenderer.send('refresh-data'),
  quit: () => ipcRenderer.send('quit-app'),

  onUsageData: (cb) => ipcRenderer.on('usage-data', (_, data) => cb(data)),
  onThemeChanged: (cb) => ipcRenderer.on('theme-changed', (_, theme) => cb(theme)),
});
