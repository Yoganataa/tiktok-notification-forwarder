# TikTok Notification Forwarder Bot

Bot Discord production-ready yang mendeteksi notifikasi TikTok Live dari bot sumber dan meneruskannya ke channel yang sesuai berdasarkan mapping.

Versi **2.2.0** (Enterprise Upgrade) memperkenalkan fitur-fitur canggih untuk reliabilitas dan otomatisasi, termasuk **Media Downloader**, **Queue System**, dan **Auto-Provisioning**.

## 🚀 Fitur Baru v2.2 (Enterprise)

- **Media Downloader**: Mengganti link TikTok dengan file video/gambar asli menggunakan `btch-downloader` (fallback ke API lain). Mengatasi limit embed Discord.
- **Reliability Queue**: Sistem antrian berbasis database (`message_queue`) memastikan notifikasi tidak hilang jika terjadi kegagalan jaringan atau limit rate Discord.
- **Strict Auto-Provisioning**: Otomatis membuat channel baru untuk user TikTok yang belum terdaftar. Nama channel disanitasi (hanya huruf a-z) dan dibuat di bawah kategori khusus.
- **Role Tagging**: Dukungan tagging role (`@Role`) pada notifikasi mapping spesifik.
- **TikTok Utility**: Command `/tiktok` untuk download manual, stalk profil, dan pencarian.

## 📋 Fitur Utama

- **Dual Database Support**: SQLite (file-based) atau PostgreSQL (production grade).
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
AUTO_CREATE_CATEGORY_ID=your_category_id_for_new_channels

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
| `/tiktok` | `dl` | Download video TikTok manual | Sudo+ |
| `/tiktok` | `stalk` | Lihat profil user TikTok | Sudo+ |
| `/tiktok` | `search` | Cari user TikTok | Sudo+ |
| `/admin` | `setrole` | Mengangkat staff (Admin/Sudo) | Owner/Admin |
| `/admin` | `revoke` | Mencabut akses staff | Owner/Admin |

### Multi-Server Architecture

1. **Core Server**: Server utama tempat bot dikonfigurasi. Notifikasi dari bot sumber di sini akan langsung diteruskan ke channel tujuan.
2. **External Server**: Server lain tempat bot diundang. Bot akan mendeteksi notifikasi di sini, lalu meneruskannya ("forward") ke Core Server dengan atribusi sumber (Embed Footer: "From Server X").

## 🏗️ Architecture

Project ini menggunakan **Modular Feature-based Architecture** untuk skalabilitas.

```
src/
├── core/                 # Core Infrastructure (Config, Database, Types)
│   ├── config/
│   ├── database/
│   ├── errors/
│   ├── repositories/     # Data Access Layer
│   └── services/         # Core Services (Migration)
├── features/             # Feature Modules
│   ├── admin/            # Admin Logic (Role, Permission)
│   ├── downloader/       # Download Engines (Strategy Pattern)
│   │   └── engines/      # Implementasi Engine (Btch, Toby, YtDlp, Hans)
│   ├── forwarder/        # Message Listener & Routing Logic
│   ├── mapping/          # User Mapping Logic
│   ├── menu/             # Interactive Menu UI & Router
│   ├── notification/     # Embed Builder & Notification Logic
│   ├── queue/            # Job Queue System
│   ├── start/            # Start Command
│   └── tiktok/           # TikTok Utility Commands (Search, Stalk)
├── shared/               # Shared Utilities & Components
│   ├── components/       # UI Components (Paginator)
│   └── utils/            # Helpers (Logger, Retry, Validation)
└── index.ts              # Application Entry Point
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

### Media Downloader & Queue Architecture

Bot ini menggunakan sistem antrian (`QueueService`) untuk menangani download media yang berat.
1. `ForwarderService` mendeteksi link, melakukan **Sanitasi User**, dan menyimpan metadata (URL, Channel ID) ke tabel `message_queue`.
2. Sebuah **Worker Process** (interval loop) membaca job `PENDING` dari database.
3. `DownloaderService` mendownload media (Video/Slides) ke memori (Buffer).
4. Jika file < 25MB, bot mengupload file tersebut ke Discord.
5. Jika gagal atau file terlalu besar, bot otomatis fallback mengirim link asli.

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
