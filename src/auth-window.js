const { BrowserWindow } = require('electron');
const http = require('http');
const { generatePKCE, buildAuthUrl, exchangeCode } = require('./oauth');

let authWindow = null;
let callbackServer = null;

function openAuthWindow() {
  return new Promise((resolve) => {
    if (authWindow) {
      authWindow.focus();
      return;
    }

    const { verifier, challenge } = generatePKCE();
    let resolved = false;

    function finish(result) {
      if (resolved) return;
      resolved = true;
      if (callbackServer) { callbackServer.close(); callbackServer = null; }
      if (authWindow) { authWindow.close(); authWindow = null; }
      resolve(result);
    }

    callbackServer = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      const style = 'body{background:#0e0e18;color:#eeeef4;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.c{text-align:center}';

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><style>${style}h2{color:#5DCAA5}</style></head><body><div class="c"><h2>Authenticated!</h2><p>Return to m8r.</p></div></body></html>`);

        try {
          const tokens = await exchangeCode(code, verifier, redirectUri);
          finish(tokens);
        } catch (err) {
          finish(null);
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><style>${style}h2{color:#E24B4A}</style></head><body><div class="c"><h2>Failed</h2><p>${error || 'Unknown error'}</p></div></body></html>`);
        finish(null);
      }
    });

    let redirectUri;

    callbackServer.listen(0, '127.0.0.1', () => {
      const port = callbackServer.address().port;
      redirectUri = `http://localhost:${port}/oauth/callback`;

      authWindow = new BrowserWindow({
        width: 960,
        height: 700,
        title: 'm8r — Sign in to Anthropic',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          partition: 'persist:anthropic-auth',
        },
      });

      authWindow.loadURL(buildAuthUrl(redirectUri, challenge));

      authWindow.on('closed', () => {
        authWindow = null;
        finish(null);
      });
    });

    callbackServer.on('error', () => finish(null));
  });
}

module.exports = { openAuthWindow };
