const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  fetchStockData: (ticker) => ipcRenderer.invoke('fetch-stock-data', ticker),
  fetchStockSummary: (ticker) => ipcRenderer.invoke('fetch-stock-summary', ticker),
  fetchStockHistory: (ticker, range) => ipcRenderer.invoke('fetch-stock-history', { ticker, range }),
  fetchIndexHistory: (ticker, fromDate, toDate) => ipcRenderer.invoke('fetch-index-history', { ticker, fromDate, toDate }),
  fetchMFData: (schemeCode) => ipcRenderer.invoke('fetch-mf-data', schemeCode),
  windowControl: (action) => ipcRenderer.send('window-control', action),
  isElectron: true,
});
