# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is m8r

m8r is an Electron system tray / menu bar app that monitors Claude API rate limit utilization. It authenticates via OAuth (same flow as Claude Code) and polls the Anthropic OAuth usage API to show current and weekly rate limit status.

## Commands

```bash
npm install          # Install dependencies
npm start            # Run the app (launches Electron)
npm run build:win    # Build Windows installer (NSIS) → dist/
npm run build:mac    # Build macOS DMG → dist/
npm run build:linux  # Build Linux AppImage → dist/
```

Building on Windows requires the winCodeSign cache to be pre-populated (symlink issue workaround — see the `winCodeSign-2.6.0` directory in `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`).

There is no test suite or linter configured.

## Architecture

**OAuth flow** (`src/oauth.js`, `src/auth-window.js`):
- OAuth 2.0 Authorization Code with PKCE against `claude.ai/oauth/authorize`
- Token exchange at `console.anthropic.com/v1/oauth/token`
- Client ID shared with Claude Code (`9d1c250a-...`)
- Auth window opens a BrowserWindow to the OAuth URL; a localhost HTTP server receives the callback
- Falls back to reading Claude Code's existing token from `~/.claude/.credentials.json` or `CLAUDE_CODE_OAUTH_TOKEN` env var
- Handles token refresh automatically on 401 responses

**API client** (`src/api-client.js`):
- Single endpoint: `GET https://api.anthropic.com/api/oauth/usage` with Bearer token auth
- Requires `anthropic-beta: oauth-2025-04-20` header
- Returns rate limit data: `five_hour` (current window), `seven_day` (weekly), and optional `extra_usage`

**Main process** (`src/main.js`):
- Token lifecycle: try stored token → Claude Code credentials → prompt OAuth sign-in
- Polls usage API at configurable interval (default 1 min)
- Stores settings and tokens via `electron-store`
- Desktop notifications fire when utilization crosses the alert threshold

**Tray icon** (`src/tray-icon.js`):
- 16x16 RGBA circle generated programmatically from raw pixel buffers
- Fill level = max(5h, 7d) utilization; color: purple <50%, amber 50-80%, red >80%

**IPC bridge** (`src/preload.js`):
- Exposes `window.m8r` with typed IPC methods via `contextBridge`

**Renderer UIs** (plain HTML, no framework):
- `src/popup.html` — rate limit bars (current + weekly), extra usage, reset times
- `src/settings.html` — sign in/out, poll interval, alert threshold
- Both follow system light/dark theme

## Key Details

- OAuth tokens are stored in electron-store (OS app data directory)
- On macOS the dock icon is hidden; utilization % is shown in the menu bar title
- The popup window is frameless, transparent, always-on-top, and auto-hides on blur
- Token refresh happens automatically; falls back to re-reading Claude Code credentials
