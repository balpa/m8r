# m8r — Claude API Usage Monitor

A lightweight system tray (Windows) / menu bar (macOS) app that shows your Anthropic Claude API usage and costs at a glance.

![m8r](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-7F77DD)

## Features

- **System tray / menu bar icon** — shows a fill-level indicator based on budget usage
- **Click-to-expand panel** — total spend, per-model breakdown (Opus, Sonnet, Haiku), daily token sparkline
- **Budget tracking** — set a monthly budget, see progress bar with color-coded warnings
- **Desktop notifications** — alerts when you hit your budget threshold (configurable)
- **Auto-refresh** — polls the Anthropic Usage API at a configurable interval (default: 5 min)
- **Light / dark mode** — follows your system theme automatically
- **macOS menu bar title** — shows dollar amount directly in the menu bar (macOS only)

## Requirements

- **Node.js** 18+ (https://nodejs.org)
- **Anthropic Admin API key** — get one from [console.anthropic.com](https://console.anthropic.com) → Settings → API Keys → Create Admin Key

> ⚠️ You need an **Admin** API key (starts with `sk-ant-admin-...`), not a regular API key. Only org admins can create these.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the app
npm start
```

On first launch, click the tray icon → **Settings** and paste your Admin API key.

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

The app uses Anthropic's [Usage and Cost API](https://docs.anthropic.com/en/api/usage-cost-api):

- **Usage endpoint** (`/v1/organizations/usage_report/messages`) — token counts by model and day
- **Cost endpoint** (`/v1/organizations/cost_report`) — dollar amounts by model

Data is fetched every 5 minutes (configurable) and cached locally. Your API key is stored in your OS keychain via `electron-store` and is only sent to `api.anthropic.com`.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Admin API Key | — | Your `sk-ant-admin-...` key |
| Monthly Budget | $100 | Your spending target |
| Poll Interval | 5 min | How often to refresh data |
| Alert Threshold | 80% | Budget % that triggers a notification |
| Alerts Enabled | Yes | Toggle desktop notifications |

## Project Structure

```
m8r/
├── src/
│   ├── main.js          # Electron main process (tray, windows, polling)
│   ├── preload.js       # Secure IPC bridge
│   ├── api-client.js    # Anthropic Usage/Cost API client
│   ├── tray-icon.js     # Dynamic tray icon generator
│   ├── popup.html       # Main panel UI
│   └── settings.html    # Settings window UI
├── assets/              # App icons (add your own .ico/.icns/.png)
├── package.json
└── README.md
```

## Tray Icon

The tray icon is a small circle that fills up based on your budget usage:

- 🟣 **Purple** — under 50% of budget
- 🟠 **Amber** — 50–80% of budget
- 🔴 **Red** — over 80% of budget

On macOS, the current dollar amount is also shown as text in the menu bar.

## Troubleshooting

**"API error 401"** — Your API key is invalid or expired. Generate a new Admin key from the Anthropic Console.

**"API error 403"** — Your key doesn't have admin permissions. You need an Admin API key, not a regular one.

**No data showing** — The Usage API can take up to 5 minutes after API calls for data to appear. Also check that you've actually made API calls this month.

**Icon not appearing (Linux)** — Some Linux DEs require `libappindicator`. Install it with `sudo apt install libappindicator3-1`.

## License

MIT
