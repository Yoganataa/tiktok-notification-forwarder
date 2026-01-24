# TikTok Notification Forwarder Bot

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

A robust, enterprise-grade Discord bot designed to forward TikTok notifications from a source bot (e.g., a self-bot or webhook) to specific Discord channels. It features auto-provisioning, media downloading (videos & slideshows), role tagging, and a resilient queue system.

---

## 🚀 Features

-   **Intelligent Forwarding**: Detects TikTok links from specific source bots and forwards them to mapped channels.
-   **Multi-Engine Downloader**: Automatically downloads TikTok videos and photo slides to prevent link rot and embed issues.
    -   Supported Engines: **Vette** (Default), **Hans**, **Btch**, **YtDlp**.
-   **Smart Auto-Provisioning**:
    -   If a user is not mapped, the bot automatically creates a new channel (sanitized username) under a configured category.
    -   Updates the database mapping immediately.
-   **Resilient Queue System**:
    -   Database-backed message queue (SQLite/PostgreSQL) ensures no notifications are lost during restarts or rate limits.
    -   **Attachment Chunking**: Automatically splits notifications with >10 images (slideshows) into multiple messages to respect Discord API limits.
-   **Role Tagging**: Optional role pings per user mapping.
-   **Maintenance & Recovery**:
    -   `/reforgot <message_id>`: Reprocess missed notifications from history after downtime.
    -   Global command registration for cross-server management.
-   **Admin Dashboard**: comprehensive `/menu` for managing mappings, roles, and system config.

---

## 🏗 Architecture

The project follows a **Modular Feature-based Architecture**, prioritizing separation of concerns and scalability:

```
src/
├── core/           # Core infrastructure (DB, Config, Migrations)
├── features/       # Feature modules (Admin, Downloader, Forwarder, Queue, etc.)
│   ├── admin/      # Admin commands & logic
│   ├── downloader/ # Media downloading engines (Vette, Toby, etc.)
│   ├── forwarder/  # Message processing logic
│   ├── mapping/    # User-to-Channel mapping
│   ├── menu/       # Interactive UI controllers
│   ├── notification/# Notification parsing & formatting
│   └── queue/      # Job queue implementation
├── shared/         # Shared utilities (Logger, Network, Discord Chunker)
└── index.ts        # Application entry point
```

---

## 🛠 Prerequisites

-   **Node.js**: v18 or higher
-   **Database**: SQLite (default) or PostgreSQL
-   **FFmpeg**: Required if using `yt-dlp` engine.

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/tiktok-notification-forwarder.git
    cd tiktok-notification-forwarder
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file based on the example below:

    ```env
    # Discord Configuration
    DISCORD_TOKEN=your_bot_token
    CLIENT_ID=your_client_id
    OWNER_ID=your_user_id
    CORE_SERVER_ID=your_main_server_id

    # Bot Logic
    SOURCE_BOT_IDS=123456789,987654321
    FALLBACK_CHANNEL_ID=channel_id_for_unknown_users
    AUTO_CREATE_CATEGORY_ID=category_id_for_new_channels

    # Database (sqlite or postgres)
    DB_DRIVER=sqlite
    DATABASE_URL=./database.sqlite

    # TikTok Downloader
    DOWNLOAD_ENGINE=vette  # vette, hans, btch, or ytdlp
    AUTO_DOWNLOAD=true
    ```

4.  **Build & Start**
    ```bash
    npm run build
    npm start
    ```

---

## 🎮 Commands

| Command | Description | Permission |
| :--- | :--- | :--- |
| `/menu` | Open the main Admin Dashboard (Manage Mappings, Config, Roles). | Admin/Sudo (Core Guild) |
| `/mapping add <user> <channel>` | Quickly map a TikTok username to a Discord channel. | Admin/Sudo (Core Guild) |
| `/tiktok dl <url>` | Manually download a TikTok video/slide. | Core Guild |
| `/reforgot <msg_id>` | Reprocess missed notifications starting from a Message ID. | Sudo (Global) |
| `/start` | Display bot status and info. | Core Guild |

---

## 📜 Credits & Acknowledgments

This project stands on the shoulders of giants. We utilize code and logic from the following open-source projects for our media downloading capabilities:

*   **[tiktok-downloader](https://github.com/Vette1123/tiktok-downloader)** by Vette1123 (Integrated as `vette` engine).
*   **[tiktok-dl](https://github.com/hansputera/tiktok-dl)** by Hansputera (Integrated as `hans` engine).
*   **[btch-downloader](https://github.com/hostinger-bot/btch-downloader)** by BochilTeam.
*   **[youtube-dl-exec](https://github.com/microlinkhq/youtube-dl-exec)**.

See [LICENSE](LICENSE) for full third-party license details.

---

## ⚖️ Disclaimer

This bot is for educational and personal use. It is not affiliated with, endorsed by, or associated with TikTok or ByteDance. Downloading copyrighted content without permission may violate Terms of Service or local laws. Use responsibly.

---

**License**: MIT

## 👩‍💻 Development

Want to add a new command or downloader engine?
Check out the **[Developer Guide](docs/DEVELOPMENT.md)** for instructions on using the Dynamic Module Loader system.
