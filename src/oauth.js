const crypto = require('crypto');
const https = require('https');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTH_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function _httpsPost(url, formData) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = new URLSearchParams(formData).toString();

    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && json.access_token) {
            resolve({
              accessToken: json.access_token,
              refreshToken: json.refresh_token || null,
              expiresIn: json.expires_in || 3600,
            });
          } else {
            reject(new Error(json.error_description || json.error || `Token request failed (${res.statusCode})`));
          }
        } catch (e) {
          reject(new Error(`Invalid token response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Token request timeout')); });
    req.write(body);
    req.end();
  });
}

function exchangeCode(code, verifier, redirectUri) {
  return _httpsPost(TOKEN_URL, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
}

function refreshAccessToken(refreshToken) {
  return _httpsPost(TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
}

function readClaudeCodeToken() {
  // Environment variable
  const envToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (envToken) {
    return { accessToken: envToken, refreshToken: null };
  }

  // ~/.claude/.credentials.json
  const credPath = path.join(os.homedir(), '.claude', '.credentials.json');
  try {
    const data = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const oauth = data.claudeAiOauth;
    if (oauth && oauth.accessToken) {
      return {
        accessToken: oauth.accessToken,
        refreshToken: oauth.refreshToken || null,
      };
    }
  } catch {}

  return null;
}

function buildAuthUrl(redirectUri, codeChallenge) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'user:inference user:profile',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

module.exports = {
  generatePKCE,
  exchangeCode,
  refreshAccessToken,
  readClaudeCodeToken,
  buildAuthUrl,
};
