const { app, BrowserWindow, Menu } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    backgroundColor: '#0a0a0a',
    title: 'Toolix',
    show: false
  });
  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
