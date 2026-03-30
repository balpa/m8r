const {
  app,
  BrowserWindow,
  Tray,
  ipcMain,
  screen,
  shell,
  nativeTheme,
} = require('electron');
const path = require('path');
const Store = require('electron-store');
const UsageClient = require('./api-client');
const { createTrayIcon, createDefaultIcon } = require('./tray-icon');
const { openAuthWindow } = require('./auth-window');
const { readClaudeCodeToken, refreshAccessToken } = require('./oauth');

const store = new Store({
  defaults: {
    accessToken: '',
    refreshToken: '',
    pollIntervalMinutes: 2,
    alertThreshold: 80,
    alertEnabled: true,
  },
});

let tray = null;
let popupWindow = null;
let pollTimer = null;
let lastData = null;
let pinned = false;
let blurTimeout = null;
let backoffUntil = 0;

const client = new UsageClient(store.get('accessToken'));

function isConnected() {
  return !!store.get('accessToken');
}

function ensureToken() {
  if (store.get('accessToken')) return true;
  const ccToken = readClaudeCodeToken();
  if (ccToken) {
    store.set('accessToken', ccToken.accessToken);
    if (ccToken.refreshToken) store.set('refreshToken', ccToken.refreshToken);
    client.setToken(ccToken.accessToken);
    return true;
  }
  return false;
}

async function handleTokenExpired() {
  const refresh = store.get('refreshToken');
  if (refresh) {
    try {
      const tokens = await refreshAccessToken(refresh);
      store.set('accessToken', tokens.accessToken);
      if (tokens.refreshToken) store.set('refreshToken', tokens.refreshToken);
      client.setToken(tokens.accessToken);
      return true;
    } catch {}
  }
  const ccToken = readClaudeCodeToken();
  if (ccToken) {
    store.set('accessToken', ccToken.accessToken);
    if (ccToken.refreshToken) store.set('refreshToken', ccToken.refreshToken);
    client.setToken(ccToken.accessToken);
    return true;
  }
  store.set('accessToken', '');
  store.set('refreshToken', '');
  client.setToken('');
  return false;
}

// ── Popup window ───────────────────────────────────────

function createPopupWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  const winWidth = 380;

  popupWindow = new BrowserWindow({
    width: winWidth,
    height: 200,
    x: screenW - winWidth - 8,
    y: screenH - 200 - 8,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  popupWindow.loadFile(path.join(__dirname, 'popup.html'));

  popupWindow.on('blur', () => {
    if (pinned) return;
    clearTimeout(blurTimeout);
    blurTimeout = setTimeout(() => {
      if (popupWindow && popupWindow.isVisible() && !popupWindow.isFocused()) {
        popupWindow.hide();
      }
    }, 150);
  });

  popupWindow.on('closed', () => { popupWindow = null; });
}

function positionPopupNearTray() {
  if (!popupWindow || !tray) return;

  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const winBounds = popupWindow.getBounds();
  const { workArea } = display;

  let x, y;
  if (process.platform === 'darwin') {
    x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
    y = trayBounds.y + trayBounds.height + 4;
  } else {
    if (trayBounds.y > workArea.height / 2) {
      x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
      y = trayBounds.y - winBounds.height - 4;
    } else {
      x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
      y = trayBounds.y + trayBounds.height + 4;
    }
  }

  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - winBounds.width));
  y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - winBounds.height));
  popupWindow.setPosition(x, y, false);
}

function togglePopup() {
  if (!popupWindow) createPopupWindow();

  if (popupWindow.isVisible()) {
    popupWindow.hide();
  } else {
    // Fix flicker: send data + position before showing, fade in via opacity
    sendDataToPopup();
    if (!pinned) positionPopupNearTray();
    popupWindow.setOpacity(0);
    popupWindow.show();
    setTimeout(() => {
      if (popupWindow) {
        popupWindow.setOpacity(1);
        popupWindow.focus();
      }
    }, 40);
  }
}

// ── Data ───────────────────────────────────────────────

function sendDataToPopup() {
  if (popupWindow && popupWindow.webContents) {
    popupWindow.webContents.send('usage-data', {
      data: lastData,
      isConnected: isConnected(),
    });
  }
}

function updateTray() {
  if (!tray) return;

  if (lastData && lastData.fiveHour) {
    tray.setImage(createTrayIcon(lastData.fiveHour.utilization, lastData.sevenDay.utilization));
    tray.setToolTip(`m8r — ${lastData.fiveHour.utilization}% current · ${lastData.sevenDay.utilization}% weekly`);
    if (process.platform === 'darwin') {
      tray.setTitle(`${lastData.fiveHour.utilization}%`, { fontType: 'monospacedDigit' });
    }
  } else {
    tray.setImage(createDefaultIcon());
    tray.setToolTip('m8r — Claude usage monitor');
    if (process.platform === 'darwin') tray.setTitle('');
  }
}

async function pollUsage() {
  if (!isConnected()) return;

  // Skip if we're in a backoff period
  if (Date.now() < backoffUntil) return;

  try {
    lastData = await client.fetchUsage();
    lastData.error = null;
    backoffUntil = 0;
    updateTray();
    sendDataToPopup();

    const threshold = store.get('alertThreshold');
    const alertEnabled = store.get('alertEnabled');
    const pct = Math.max(lastData.fiveHour.utilization, lastData.sevenDay.utilization);

    if (alertEnabled && pct >= threshold) {
      const { Notification } = require('electron');
      if (Notification.isSupported()) {
        new Notification({
          title: 'm8r — Rate limit warning',
          body: `Current: ${lastData.fiveHour.utilization}% · Weekly: ${lastData.sevenDay.utilization}%`,
        }).show();
      }
    }
  } catch (err) {
    if (err.message === 'TOKEN_EXPIRED') {
      const refreshed = await handleTokenExpired();
      if (refreshed) return pollUsage();
    }

    let errorType = 'UNKNOWN';
    let errorDetail = null;

    if (err.message === 'RATE_LIMITED') {
      errorType = 'RATE_LIMITED';
      const waitSec = err.retryAfter || 60;
      backoffUntil = Date.now() + waitSec * 1000;
      errorDetail = `Retry in ${waitSec >= 60 ? Math.ceil(waitSec / 60) + 'm' : waitSec + 's'}`;
    } else if (err.message === 'API_OVERLOADED') {
      errorType = 'API_OVERLOADED';
      backoffUntil = Date.now() + 30000;
    } else if (err.message === 'Request timeout') {
      errorType = 'TIMEOUT';
    } else if (err.message === 'Not authenticated') {
      errorType = 'NOT_AUTH';
    } else if (err.message === 'TOKEN_EXPIRED') {
      errorType = 'TOKEN_EXPIRED';
    } else {
      errorType = 'API_ERROR';
      errorDetail = err.message;
    }

    lastData = {
      error: errorType,
      errorDetail,
      fiveHour: lastData?.fiveHour || null,
      sevenDay: lastData?.sevenDay || null,
      extraUsage: lastData?.extraUsage || null,
      fetchedAt: new Date().toISOString(),
    };
    updateTray();
    sendDataToPopup();
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const mins = Math.max(store.get('pollIntervalMinutes'), 2);
  const interval = mins * 60 * 1000;
  pollUsage();
  pollTimer = setInterval(pollUsage, interval);
}

// ── IPC ────────────────────────────────────────────────

ipcMain.handle('get-settings', () => ({
  isConnected: isConnected(),
  pollIntervalMinutes: store.get('pollIntervalMinutes'),
  alertThreshold: store.get('alertThreshold'),
  alertEnabled: store.get('alertEnabled'),
}));

ipcMain.handle('save-settings', (_, settings) => {
  if (settings.pollIntervalMinutes !== undefined) store.set('pollIntervalMinutes', settings.pollIntervalMinutes);
  if (settings.alertThreshold !== undefined) store.set('alertThreshold', settings.alertThreshold);
  if (settings.alertEnabled !== undefined) store.set('alertEnabled', settings.alertEnabled);
  startPolling();
  return true;
});

ipcMain.handle('start-auth', async () => {
  const tokens = await openAuthWindow();
  if (tokens) {
    store.set('accessToken', tokens.accessToken);
    if (tokens.refreshToken) store.set('refreshToken', tokens.refreshToken);
    client.setToken(tokens.accessToken);
    startPolling();
    return true;
  }
  return false;
});

ipcMain.handle('disconnect-account', () => {
  store.set('accessToken', '');
  store.set('refreshToken', '');
  client.setToken('');
  lastData = null;
  updateTray();
  sendDataToPopup();
  return true;
});

ipcMain.handle('toggle-pin', () => {
  pinned = !pinned;
  return pinned;
});

ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

ipcMain.on('resize-to-fit', (_, height) => {
  if (!popupWindow) return;
  const h = Math.max(150, Math.min(Math.ceil(height), 600));
  const bounds = popupWindow.getBounds();
  const dy = bounds.height - h;
  popupWindow.setBounds({ x: bounds.x, y: bounds.y + dy, width: bounds.width, height: h });
});

ipcMain.on('open-usage-page', () => shell.openExternal('https://claude.ai/settings/usage'));
ipcMain.on('refresh-data', () => pollUsage());
ipcMain.on('quit-app', () => app.quit());

// ── App lifecycle ──────────────────────────────────────

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();

  tray = new Tray(createDefaultIcon());
  tray.setToolTip('m8r — Claude usage monitor');
  tray.on('click', () => togglePopup());

  tray.on('right-click', () => {
    const { Menu } = require('electron');
    tray.popUpContextMenu(Menu.buildFromTemplate([
      { label: 'Refresh', click: pollUsage },
      { label: 'Usage page', click: () => shell.openExternal('https://claude.ai/settings/usage') },
      { type: 'separator' },
      { label: 'Quit m8r', click: () => app.quit() },
    ]));
  });

  createPopupWindow();
  ensureToken();
  startPolling();
});

app.on('window-all-closed', (e) => e.preventDefault());

nativeTheme.on('updated', () => {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  if (popupWindow) popupWindow.webContents.send('theme-changed', theme);
});
