const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let appWindow;
let chatWindow = null;

function initWindow() {
    appWindow = new BrowserWindow({
        // fullscreen: true,
        height: 800,
        width: 1000,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    // Load index.html using loadFile for proper hash routing support
    const indexPath = path.join(__dirname, 'dist', 'client', 'index.html');
    appWindow.loadFile(indexPath);

    // Handle navigation to hash routes (refresh/redirect)
    appWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        if (validatedURL.includes('#')) {
            appWindow.loadFile(indexPath);
        }
    });

    appWindow.setMenuBarVisibility(false)


    appWindow.on('closed', function () {
        appWindow = null;
        if (chatWindow) {
            chatWindow.close();
        }
    });
}

// ── Chat pop-out IPC ──────────────────────────────────────────────────

ipcMain.on('chat:pop-out', (_event, gameId) => {
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.focus();
        return;
    }
    chatWindow = null;

    chatWindow = new BrowserWindow({
        height: 600,
        width: 420,
        minWidth: 320,
        minHeight: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    const indexPath = path.join(__dirname, 'dist', 'client', 'index.html');
    chatWindow.loadFile(indexPath, { hash: `/chat-popup/${gameId}` });
    chatWindow.setMenuBarVisibility(false);

    chatWindow.on('closed', () => {
        chatWindow = null;
        if (appWindow) {
            appWindow.webContents.send('chat:anchored');
        }
    });
});

ipcMain.on('chat:anchor', () => {
    if (chatWindow) {
        chatWindow.close();
    }
});

// ── App lifecycle ─────────────────────────────────────────────────────

app.on('ready', initWindow);

// Close when all windows are closed.
app.on('window-all-closed', function () {
    // On macOS specific close process
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (appWindow === null) {
        initWindow();
    }
});
