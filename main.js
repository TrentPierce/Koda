require('dotenv').config();
const { app, BrowserWindow, ipcMain, webContents } = require('electron');
const path = require('path');
const Agent = require('./agent');

let mainWindow;
let activeAgent = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        backgroundColor: '#1e1e2e',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Required for nodeIntegration in renderer
            webviewTag: true // Required for <webview>
        }
    });

    mainWindow.loadFile('index.html');

    // Open DevTools for debugging (optional, helping the user)
    // mainWindow.webContents.openDevTools();
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

// --- IPC Handlers ---

ipcMain.on('start-agent', (event, { goal, webContentsId }) => {
    console.log(`[Main] Starting agent for goal: "${goal}"`);

    // Find the guest webContents (the browser view)
    const guestContents = webContents.fromId(webContentsId);

    if (!guestContents) {
        console.error('[Main] Guest WebContents not found!');
        event.sender.send('agent-log', '❌ Error: Could not verify browser view.');
        event.sender.send('agent-stopped');
        return;
    }

    if (activeAgent) {
        activeAgent.stop();
    }

    // Initialize Agent with (Guest, UI)
    activeAgent = new Agent(guestContents, event.sender);
    activeAgent.start(goal);
});

ipcMain.on('stop-agent', (event) => {
    console.log('[Main] Stopping agent...');
    if (activeAgent) {
        activeAgent.stop();
        activeAgent = null;
    } else {
        event.sender.send('agent-stopped');
    }
});
