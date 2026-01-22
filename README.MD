# TikTok Notification Forwarder Bot

Production-ready Discord bot to forward TikTok Live notifications from source bots to mapped channels.

Version **2.2.0** (Enterprise Upgrade) introduces advanced features for reliability and automation, including **Media Downloader**, **Queue System**, and **Auto-Provisioning**.

## 🚀 New Features v2.2 (Enterprise)

- **Media Downloader**: Replaces TikTok links with actual video/image files using multiple engines:
  - `tiktok-downloader` (Vette1123) - **Default**
  - `btch-downloader`
  - `youtube-dl-exec` (yt-dlp wrapper)
  - `TobyG74/tiktok-api-dl` (Integrated Source)
  - `hansputera/tiktok-dl` (Integrated Source)
- **Reliability Queue**: Database-backed queue system (`message_queue`) ensures notifications are never lost due to network failure or rate limits.
- **Strict Auto-Provisioning**: Automatically creates channels for unregistered TikTok users. Sanitizes channel names and organizes them under a specific category.
- **Role Tagging**: Support for role tagging (`@Role`) on specific mappings.
- **TikTok Utility**: New `/tiktok` command for manual download, profile stalking, and searching.

## 📋 Key Features

- **Dual Database Support**: SQLite (file-based) or PostgreSQL (production grade).
- **Auto-Detection**: Detects live notifications using multiple regex patterns.
- **Multi-Server Support**: Forwards notifications from external servers to the core server.
- **Smart Forwarding**: Routes notifications to specific channels based on user mapping.
- **Central Mapping**: All mappings are stored centrally.
- **Slash Commands**: Manage via `/mapping`, `/admin`, and `/menu`.
- **Resilience**: Automatic retry logic with exponential backoff.
- **Structured Logging**: Winston logger with file rotation (JSON & Human Readable).

## 🔧 Setup Guide

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and configure your database and Discord settings.

### 3. Build Project

This step compiles TypeScript and copies migration files.

```bash
npm run build
```

### 4. Run Bot

The bot automatically runs database migrations on startup.

```bash
npm start
```

## 📖 Usage

### Slash Commands

| Command | Subcommand | Description | Permission |
| --- | --- | --- | --- |
| `/menu` | - | Open Interactive Control Panel | Admin |
| `/mapping` | `add` | Add mapping TikTok user -> Channel | Sudo+ |
| `/tiktok` | `dl` | Manual TikTok video download | Sudo+ |
| `/tiktok` | `stalk` | View TikTok user profile | Sudo+ |
| `/tiktok` | `search` | Search TikTok user | Sudo+ |
| `/admin` | `setrole` | Assign staff (Admin/Sudo) | Owner/Admin |

## 🏗️ Architecture

This project follows a **Modular Feature-based Architecture**:

```
src/
├── core/                 # Core Infrastructure (Config, Database, Types)
├── features/             # Feature Modules
│   ├── admin/            # Admin Logic
│   ├── downloader/       # Download Engines (Strategy Pattern)
│   ├── forwarder/        # Message Listener & Routing Logic
│   ├── mapping/          # User Mapping Logic
│   ├── menu/             # Interactive Menu UI
│   ├── notification/     # Embed Builder
│   ├── queue/            # Job Queue System
│   └── tiktok/           # TikTok Utility Commands
├── shared/               # Shared Utilities
└── index.ts              # Entry Point
```

## 👥 Credits & Acknowledgments

This project utilizes several open-source libraries and repositories for its media downloading capabilities:

- **[tiktok-downloader](https://github.com/Vette1123/tiktok-downloader)**: Primary download engine.
- **[btch-downloader](https://github.com/hostinger-bot/btch-downloader)**: Alternative engine.
- **[youtube-dl-exec](https://github.com/microlinkhq/youtube-dl-exec)**: Wrapper for yt-dlp binary.
- **[tiktok-api-dl](https://github.com/TobyG74/tiktok-api-dl)** by TobyG74: Integrated source code for API-based downloading.
- **[tiktok-dl](https://github.com/hansputera/tiktok-dl)** by hansputera: Integrated source code for scraping-based downloading.

## 📄 License

MIT License - Copyright (c) 2025 yoganataa

See [LICENSE](LICENSE) for more details.
