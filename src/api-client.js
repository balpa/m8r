const https = require('https');

class UsageClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  setToken(token) {
    this.accessToken = token;
  }

  fetchUsage() {
    return new Promise((resolve, reject) => {
      if (!this.accessToken) {
        return reject(new Error('Not authenticated'));
      }

      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/api/oauth/usage',
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'anthropic-beta': 'oauth-2025-04-20',
          'User-Agent': 'm8r/1.0.0',
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode === 401) {
              return reject(new Error('TOKEN_EXPIRED'));
            }
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(this._transform(JSON.parse(data)));
            } else {
              reject(new Error(`API error ${res.statusCode}: ${data.slice(0, 200)}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
      req.end();
    });
  }

  _transform(raw) {
    return {
      fiveHour: {
        utilization: Math.round(raw.five_hour?.utilization ?? 0),
        resetsAt: raw.five_hour?.resets_at || null,
      },
      sevenDay: {
        utilization: Math.round(raw.seven_day?.utilization ?? 0),
        resetsAt: raw.seven_day?.resets_at || null,
      },
      extraUsage: raw.extra_usage ? {
        isEnabled: raw.extra_usage.is_enabled || false,
        utilization: Math.round(raw.extra_usage.utilization ?? 0),
        usedCredits: raw.extra_usage.used_credits || 0,
        monthlyLimit: raw.extra_usage.monthly_limit || 0,
      } : null,
      fetchedAt: new Date().toISOString(),
      error: null,
    };
  }
}

module.exports = UsageClient;
