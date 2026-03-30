# m8r — Claude API Usage Monitor

A lightweight system tray (Windows) / menu bar (macOS) app that shows your Anthropic Claude API usage and costs at a glance.

![m8r](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-7F77DD)

## Features

- **System tray / menu bar icon** — shows a fill-level indicator based on rate limit utilization
- **Click-to-expand panel** — current and weekly rate limits with countdown timers, extra usage tracking
- **OAuth sign-in** — authenticate with your Anthropic account, no API key needed
- **Pin-to-screen widget** — pin the panel to keep it visible as a desktop widget
- **Desktop notifications** — alerts when rate limit utilization hits your threshold (configurable)
- **Auto-refresh** — polls the usage API at a configurable interval (default: 1 min)
- **Light / dark mode** — follows your system theme automatically
- **macOS menu bar title** — shows utilization % directly in the menu bar (macOS only)

## Requirements

- **Node.js** 18+ (https://nodejs.org)
- **Anthropic account** — sign in via OAuth on first launch (no API key needed)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the app
npm start
```

On first launch, click the tray icon and sign in with your Anthropic account.

## Build Standalone Executables

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Built files will be in the `dist/` folder.

## How It Works

The app authenticates via OAuth (same flow as Claude Code) and fetches rate limit data from Anthropic's usage API:

- **Usage endpoint** (`/api/oauth/usage`) — current and weekly rate limit utilization, extra usage

Data is fetched every minute (configurable) and cached locally. OAuth tokens are stored locally via `electron-store` and are only sent to Anthropic's servers.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Poll Interval | 1 min | How often to refresh data |
| Alert Threshold | 80% | Rate limit % that triggers a notification |
| Alerts Enabled | Yes | Toggle desktop notifications |

## Project Structure

```
m8r/
├── src/
│   ├── main.js          # Electron main process (tray, windows, polling)
│   ├── preload.js       # Secure IPC bridge
│   ├── oauth.js         # OAuth 2.0 PKCE flow
│   ├── auth-window.js   # OAuth browser window
│   ├── api-client.js    # Anthropic usage API client
│   ├── tray-icon.js     # Dynamic tray icon generator
│   └── popup.html       # Main panel UI (data + inline settings)
├── assets/              # App icons
├── package.json
└── README.md
```

## Tray Icon

The tray icon is a small circle that fills up based on your rate limit utilization:

- 🟣 **Purple** — under 50% utilization
- 🟠 **Amber** — 50–80% utilization
- 🔴 **Red** — over 80% utilization

On macOS, the current utilization % is also shown as text in the menu bar.

## Troubleshooting

**"TOKEN_EXPIRED"** — Your OAuth token has expired. The app will try to refresh it automatically. If it persists, sign out and sign back in.

**No data showing** — Make sure you're signed in. The usage API may take a moment to return data after authentication.

**Icon not appearing (Linux)** — Some Linux DEs require `libappindicator`. Install it with `sudo apt install libappindicator3-1`.

## License

MIT
