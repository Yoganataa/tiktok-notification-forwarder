# TikTok Notification Forwarder Bot

Bot Discord production-ready yang mendeteksi notifikasi TikTok Live dari bot sumber dan meneruskannya ke channel yang sesuai berdasarkan mapping.

Versi **2.1.0** memperkenalkan **Adapter Pattern** pada layer database, memungkinkan fleksibilitas penuh untuk menggunakan **SQLite** (tanpa setup server) atau **PostgreSQL** (untuk skala besar) tanpa mengubah logika bisnis.

## 🚀 Fitur Baru v2.1

- **Dual Database Support**: Dukungan native untuk SQLite (`better-sqlite3`) dan PostgreSQL (`pg`).
- **Zero-Dependency Start**: Mode SQLite berjalan langsung dari file lokal. Tidak butuh Docker atau install server database.
- **Auto-Migration**: Sistem migrasi mandiri yang mendeteksi driver aktif dan menjalankan skema SQL yang sesuai saat startup.
- **Hot-Reload Config**: Update konfigurasi bot tanpa restart via command `/menu`.

## 📋 Fitur Utama

- **Auto-Detection**: Mendeteksi notifikasi live menggunakan multiple regex patterns.
- **Multi-Server Support**: Bot dapat meneruskan notifikasi dari server eksternal ke core server.
- **Smart Forwarding**: Routing notifikasi ke channel spesifik per user.
- **Central Mapping**: Semua mapping disimpan terpusat di core server.
- **Slash Commands**: Manajemen via `/mapping`, `/admin`, dan `/menu`.
- **Resilience**: Retry logic otomatis dengan exponential backoff.
- **Structured Logging**: Winston logger dengan file rotation (JSON & Human Readable).

## 🔧 Setup Guide

### 1. Install Dependencies

```bash
npm install

```

### 2. Configure Environment

Salin `.env.example` ke `.env`:

```bash
cp .env.example .env

```

Edit `.env` dan pilih mode database Anda:

```env
# --- DISCORD ---
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
OWNER_ID=your_discord_id
SOURCE_BOT_IDS=123456789,987654321
CORE_SERVER_ID=main_guild_id
FALLBACK_CHANNEL_ID=log_channel_id

# --- DATABASE OPTION 1: SQLite (Recommended untuk Local/Small Scale) ---
DATABASE_URL=sqlite://./database.sqlite
DB_DRIVER=sqlite

# --- DATABASE OPTION 2: PostgreSQL (Untuk High Performance) ---
# DATABASE_URL=postgres://user:pass@localhost:5432/dbname
# DB_DRIVER=postgres

# --- TUNING ---
DB_MAX_CONNECTIONS=10
DB_MIN_CONNECTIONS=2
NODE_ENV=production
LOG_LEVEL=info

```

### 3. Build Project

Langkah ini penting untuk meng-compile TypeScript dan **menyalin aset migrasi SQL** ke folder dist.

```bash
npm run build

```

### 4. Run Bot

Bot akan secara otomatis menjalankan migrasi database (membuat tabel) saat pertama kali dijalankan.

```bash
npm start

```

## 📖 Usage

### Slash Commands

| Command | Subcommand | Deskripsi | Permission |
| --- | --- | --- | --- |
| `/menu` | - | Membuka Control Panel Interaktif | Admin |
| `/mapping` | `add` | Menambah mapping user TikTok -> Channel | Sudo+ |
| `/mapping` | `remove` | Menghapus mapping | Admin |
| `/mapping` | `list` | Melihat semua mapping aktif | Sudo+ |
| `/mapping` | `info` | Cek detail mapping spesifik | Sudo+ |
| `/admin` | `setrole` | Mengangkat staff (Admin/Sudo) | Owner/Admin |
| `/admin` | `revoke` | Mencabut akses staff | Owner/Admin |

### Multi-Server Architecture

1. **Core Server**: Server utama tempat bot dikonfigurasi. Notifikasi dari bot sumber di sini akan langsung diteruskan ke channel tujuan.
2. **External Server**: Server lain tempat bot diundang. Bot akan mendeteksi notifikasi di sini, lalu meneruskannya ("forward") ke Core Server dengan atribusi sumber (Embed Footer: "From Server X").

## 🏗️ Architecture

```
src/
├── commands/             # Handler Slash Command
├── controllers/          # Logika interaksi UI (Button/Modal)
├── core/
│   ├── config/           # Config Manager & Loader
│   ├── database/         # Database Layer
│   │   ├── migrations/   # SQL Files (Postgres & SQLite separated)
│   │   ├── connection.ts # Adapter Pattern Logic (Driver Switcher)
│   │   └── transaction.ts# Abstract Transaction Handler
│   └── types/            # Type Definitions
├── repositories/         # Data Access Layer (SQL Queries)
├── services/             # Business Logic (Notification, Forwarder, Migration)
└── utils/                # Helper (Logger, Retry, Validation)

```

## 🛠️ Maintenance & Troubleshooting

### Database Backup (SQLite)

Cukup copy file `database.sqlite` yang ada di root folder.

```bash
cp database.sqlite backup_$(date +%Y%m%d).sqlite

```

### Reset Database

Hapus file database dan restart bot untuk regenerasi ulang.

```bash
rm database.sqlite
npm start

```

### Common Issues

**Error: `no such function: NOW**`

* Ini terjadi jika Anda menjalankan skema PostgreSQL di driver SQLite.
* **Solusi**: Pastikan Anda menggunakan kode versi 2.1.0+. Sistem migrasi sekarang otomatis memilih folder `migrations/sqlite` atau `migrations/postgres` sesuai config `.env`.

**Database Locked (SQLite)**

* Bot menggunakan mode WAL (Write-Ahead Logging) untuk performa tinggi. Pastikan tidak ada aplikasi lain (seperti DB Browser) yang menahan lock file database dalam mode "Write" saat bot berjalan.

## 🚀 Deployment (PM2)

```bash
# 1. Build
npm run build

# 2. Start
pm2 start dist/index.js --name tiktok-forwarder

# 3. Save & Startup
pm2 save
pm2 startup

```

## 📄 License

MIT License
