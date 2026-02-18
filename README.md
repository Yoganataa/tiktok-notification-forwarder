# TikTok Notification Forwarder Bot

A modular Discord bot that monitors TikTok links and forwards videos/images to Discord channels and Telegram topics.

## 🚀 Quick Start (Production)

### 1. Minimal Configuration
You only need **4 environment variables** to start the bot. Create a `.env` file:

```env
DISCORD_TOKEN=your_discord_bot_token
OWNER_ID=your_discord_user_id
CLIENT_ID=your_discord_app_id
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
# OR for SQLite
# DATABASE_URL=file:./data/bot.sqlite
```

### 2. Run the Bot
```bash
# Using Docker (Recommended)
docker-compose up -d

# OR Manual
npm install
npm run build
npm start
```

### 3. Setup via Discord
1.  Invite the bot to your server.
2.  Run the command: `/setup interactive`
3.  Use the menu to configure:
    *   **Identity:** Set your Core Server ID.
    *   **Telegram:** Enter API ID, Hash, and Session (see below).
    *   **Downloader:** Choose your engine (Devest Alpha recommended).

## ✈️ Telegram Setup (Optional)

To enable Telegram forwarding, you need a **String Session**.

1.  Run the generator script locally:
    ```bash
    npm run session
    # OR
    npx ts-node src/scripts/generate-session.ts
    ```
2.  Follow the prompts (Phone Number, OTP).
3.  Copy the generated session string.
4.  Paste it into the **Telegram Config** menu in `/setup interactive`.
5.  Click **Restart Bot** in the setup menu.

## 🛠️ Features

*   **Modular Architecture:** Core, Discord, and Telegram modules are separated.
*   **Database-First Config:** Change settings on the fly without rebooting (mostly).
*   **Smart Download:** Automatically detects TikTok links and downloads videos.
*   **Split-Brain Fix:** Checks Telegram for existing topics before creating duplicates.
*   **Parallel Processing:** Sends to Discord and Telegram simultaneously.

## 📝 Commands

*   `/setup`: Manage bot configuration (Owner only).
*   `/download [url]`: Manually download a video.
*   `/mapping`: Manage user-to-channel mappings.
*   `/menu`: Open the main control panel.

## 📦 Project Structure

*   `src/core`: Shared logic, config, database, downloader.
*   `src/discord`: Discord client, commands, listeners.
*   `src/telegram`: Telegram user client service.
*   `src/scripts`: Utility scripts (session generator).
