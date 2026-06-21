const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const net = require('net');
const http = require('http');

let mainWindow;

function checkDevServer() {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(250);
    client.once('connect', () => {
      client.destroy();
      resolve(true);
    });
    client.once('timeout', () => {
      client.destroy();
      resolve(false);
    });
    client.once('error', () => {
      client.destroy();
      resolve(false);
    });
    client.connect(5173, '127.0.0.1');
  });
}

function startTempServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body></body></html>');
    });
    server.listen(5173, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1440,
    minHeight: 900,
    frame: false, // frameless window
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0A0A0F',
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  let useDevServer = false;
  if (isDev) {
    useDevServer = await checkDevServer();
  }

  if (useDevServer) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Read Electron localStorage for both origins and export to public/exported_data.json on load
  mainWindow.webContents.on('did-finish-load', () => {
    const hiddenWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
    const origins = ['http://localhost:5173', 'file://' + path.join(__dirname, '../dist/index.html')];
    const allData = {};

    const dumpNext = async (index) => {
      if (index >= origins.length) {
        const fs = require('fs');
        const publicDir = path.join(__dirname, '../public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        const fsPath = path.join(publicDir, 'exported_data.json');
        fs.writeFileSync(fsPath, JSON.stringify(allData, null, 2));
        hiddenWin.destroy();
        return;
      }

      const origin = origins[index];
      let tempServer = null;
      try {
        if (origin.startsWith('http')) {
          const isDevServerRunning = await checkDevServer();
          if (!isDevServerRunning) {
            tempServer = await startTempServer();
          }
          await hiddenWin.loadURL(origin).catch(() => {});
        } else {
          await hiddenWin.loadFile(origin.replace('file://', '')).catch(() => {});
        }
        
        const data = await hiddenWin.webContents.executeJavaScript(`
          (() => {
            const d = {};
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              d[k] = localStorage.getItem(k);
            }
            return d;
          })()
        `);
        
        Object.assign(allData, data);
      } catch (e) {
        console.error('Failed to read localStorage for ' + origin, e);
      } finally {
        if (tempServer) {
          await new Promise((r) => tempServer.close(r));
        }
      }
      dumpNext(index + 1);
    };

    dumpNext(0);
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handler for fetching Yahoo Finance Stock Data
ipcMain.handle('fetch-stock-data', async (event, ticker) => {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    // Extract stock properties (price, PE, industry etc. from Yahoo chart or summary endpoints)
    // Yahoo Chart gives: current price (meta.regularMarketPrice), previousClose, symbol, exchangeName
    // To support PE and industry, Yahoo's query1.finance.yahoo.com/v10/finance/quoteSummary is needed.
    // Let's implement quoteSummary endpoint as well, which is richer!
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handler for quote summary (PE, Industry, Company Name)
ipcMain.handle('fetch-stock-summary', async (event, ticker) => {
  try {
    const url = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${ticker}?modules=summaryDetail,assetProfile,price`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handler for stock historical data (Performance analytics)
ipcMain.handle('fetch-stock-history', async (event, { ticker, range }) => {
  try {
    // range can be: 1mo, 3mo, 6mo, 1y, 5y
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handler for index historical data (Benchmark comparison)
ipcMain.handle('fetch-index-history', async (event, { ticker, fromDate, toDate }) => {
  try {
    const from = Math.floor(new Date(fromDate).getTime() / 1000);
    const to = Math.floor(new Date(toDate).getTime() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${from}&period2=${to}&interval=1d&events=history`;
    
    let response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      const fallbackUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${from}&period2=${to}&interval=1d&events=history`;
      response = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
    }
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handler for fetching Mutual Fund NAV from MFAPI
ipcMain.handle('fetch-mf-data', async (event, schemeCode) => {
  try {
    const url = `https://api.mfapi.in/mf/${schemeCode}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handler for window controls
ipcMain.on('window-control', (event, action) => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!win) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'maximize') {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  } else if (action === 'close') win.close();
});
