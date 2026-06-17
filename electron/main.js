const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

app.commandLine.appendSwitch('remote-debugging-port', '8315');

// ---------------------------------------------------------------------------
// Single Instance Lock — only one DevDash at a time
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let mainWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;

const isDev = !app.isPackaged;
const BACKEND_PORT = 4000;
const DEV_URL = `http://localhost:5173`;
const PROD_URL = `http://localhost:${BACKEND_PORT}`;

// ---------------------------------------------------------------------------
// Backend Server
// ---------------------------------------------------------------------------
function startBackendServer() {
  if (isDev) {
    console.log('[electron] Dev mode — backend started via concurrently');
    return;
  }

  // In production, we run the backend entirely in-process using require.
  // This is much safer than spawn() since it shares the same node runtime
  // and avoids file path issues with .asar archives.
  try {
    const backend = require(path.join(__dirname, '..', 'backend', 'server.js'));
    const userDataPath = path.join(app.getPath('userData'), 'data');
    backend.setDataDir(userDataPath);
    backendServer = backend.startServer(BACKEND_PORT);
    console.log(`[electron] Backend server started in-process on port ${BACKEND_PORT}`);
  } catch (err) {
    console.error('[electron] Failed to start backend:', err);
    require('fs').writeFileSync(
      path.join(app.getPath('userData'), 'backend-error.log'), 
      err.stack || err.toString()
    );
  }
}

// ---------------------------------------------------------------------------
// Tray Icon
// ---------------------------------------------------------------------------
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon = nativeImage.createFromPath(iconPath);

  if (trayIcon.isEmpty()) {
    console.warn('[electron] Tray icon not found, using default');
    // Create a simple colored icon as fallback
    trayIcon = nativeImage.createEmpty();
  }

  trayIcon = trayIcon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('DevDash — Project Manager');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show DevDash',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit DevDash',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Single click tray icon to show/focus window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Double click as fallback
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Main Window
// ---------------------------------------------------------------------------
function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    title: 'DevDash',
    backgroundColor: '#0f0f17',
    show: true, // Show immediately — no hidden start
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove menu bar entirely
  mainWindow.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

  // Load the frontend
  if (isDev) {
    console.log(`[electron] Loading dev URL: ${DEV_URL}`);
    mainWindow.loadURL(DEV_URL);
  } else {
    // In production, load from the Express server which serves built frontend
    console.log(`[electron] Loading production URL: ${PROD_URL}`);
    mainWindow.loadURL(PROD_URL);
  }

  // Fallback: if the page fails to load (e.g. Vite not ready yet), retry
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.log(`[electron] Page failed to load (${errorCode}: ${errorDescription}), retrying in 2s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(isDev ? DEV_URL : PROD_URL);
      }
    }, 2000);
  });

  // Focus window when content finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      console.log('[electron] Window loaded and focused');
    }
  });

  // Hide to tray instead of closing (Discord-style)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      // Show a tray balloon notification the first time
      if (tray && !app._trayNotified) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'DevDash',
          content: 'DevDash is still running in the background.\nClick the tray icon to bring it back.',
        });
        app._trayNotified = true;
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  console.log('[electron] App ready, starting...');
  startBackendServer();
  createTray();
  createWindow();
});

app.on('window-all-closed', () => {
  // On Windows, keep app alive in tray
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;

  if (backendServer) {
    try {
      backendServer.close();
    } catch (err) {
      console.error('[electron] Error closing backend server:', err);
    }
  }
});
