const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 存储相关
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),
  deleteStoreValue: (key) => ipcRenderer.invoke('delete-store-value', key),
  
  // 文件操作
  importOpml: (callback) => {
    ipcRenderer.on('import-opml', (event, filePath) => {
      callback(filePath);
    });
  },
  
  exportData: (callback) => {
    ipcRenderer.on('export-data', () => {
      callback();
    });
  },
  
  // 系统信息
  getPlatform: () => process.platform,
  getVersion: () => process.versions.electron,
  
  // 窗口操作
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window'),
  
  // 通知
  showNotification: (title, body) => {
    ipcRenderer.send('show-notification', { title, body });
  }
});

// 移除所有监听器
window.addEventListener('beforeunload', () => {
  ipcRenderer.removeAllListeners('import-opml');
  ipcRenderer.removeAllListeners('export-data');
}); 