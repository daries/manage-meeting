# Panduan Setup & Deployment — RapatKu

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Setup Development Lokal](#2-setup-development-lokal)
3. [Setup Google OAuth (SSO)](#3-setup-google-oauth-sso)
4. [Development dengan Ngrok (Email Verification)](#4-development-dengan-ngrok-email-verification)
5. [Mode Production — 1 Perintah](#5-mode-production--1-perintah)
6. [Deployment Production dengan Domain](#6-deployment-production-dengan-domain)
7. [Variabel Environment Lengkap](#7-variabel-environment-lengkap)
8. [Migrasi Database](#8-migrasi-database)

---

## 1. Prasyarat

| Tools | Versi Minimum | Keterangan |
|-------|--------------|------------|
| Node.js | 18+ | Runtime backend & frontend |
| PostgreSQL | 14+ | Database |
| npm | 9+ | Package manager |

---

## 2. Setup Development Lokal

### Clone & Install

```bash
# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

### Konfigurasi Environment

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` dan `frontend/.env` sesuai kebutuhan lokal Anda.

### Setup Database

```bash
# Masuk ke PostgreSQL
psql -U postgres

# Buat database
CREATE DATABASE meeting_manager;
\q

# Jalankan schema
psql -U postgres -d meeting_manager -f backend/database/schema.sql
```

### Jalankan Aplikasi

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Akses di: `http://localhost:5173`

---

## 3. Setup Google OAuth (SSO)

Google Client ID diperlukan agar tombol **"Masuk/Daftar dengan Google"** berfungsi.

### Langkah Membuat Google OAuth Client

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru atau pilih yang sudah ada
3. Navigasi ke **APIs & Services → Credentials**
4. Klik **Create Credentials → OAuth 2.0 Client ID**
5. Pilih tipe: **Web application**
6. Isi nama, misalnya: `RapatKu`
7. Pada **Authorized JavaScript Origins**, tambahkan URL sesuai environment:

### URL yang Perlu Ditambahkan per Environment

| Environment | Authorized JavaScript Origins |
|-------------|-------------------------------|
| Lokal | `http://localhost:5173` |
| Ngrok (dev) | `https://xxxx.ngrok-free.app` |
| Production | `https://yourdomain.com` |

> **Catatan:** Google OAuth tidak memerlukan Redirect URI jika menggunakan `@react-oauth/google` dengan implicit flow.

8. Klik **Create** → Salin **Client ID**
9. Isi di kedua file env:

```env
# backend/.env
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com

# frontend/.env
VITE_GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
```

---

## 4. Development dengan Ngrok (Email Verification)

Email konfirmasi mengandung link ke `APP_URL`. Saat development di localhost, link tersebut tidak bisa diklik dari email (karena `localhost` tidak accessible dari internet). Ngrok membuat tunnel agar URL bisa diakses publik.

### Install Ngrok

```bash
# macOS dengan Homebrew
brew install ngrok

# Atau download dari https://ngrok.com/download
```

### Daftar & Login Ngrok

```bash
# Daftar akun gratis di https://ngrok.com
# Dapatkan auth token dari dashboard ngrok
ngrok config add-authtoken <YOUR_AUTH_TOKEN>
```

### Jalankan Tunnel

```bash
# Tunnel ke port frontend (5173)
ngrok http 5173
```

Output akan menampilkan URL seperti:
```
Forwarding  https://abcd1234.ngrok-free.app -> http://localhost:5173
```

### Konfigurasi .env untuk Ngrok

Update `backend/.env`:

```env
# Ganti dengan URL ngrok yang aktif
APP_URL=https://abcd1234.ngrok-free.app
FRONTEND_URL=https://abcd1234.ngrok-free.app
```

Update `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
```

> **Catatan:** Backend tetap di `localhost:3001`. Ngrok hanya untuk frontend agar link email bisa diklik.

### Update Google OAuth

Di Google Cloud Console, tambahkan URL ngrok ke **Authorized JavaScript Origins**:
```
https://abcd1234.ngrok-free.app
```

### Alur Testing Email Verification dengan Ngrok

```
1. Buka browser → https://abcd1234.ngrok-free.app
2. Daftar akun dengan email
3. Cek inbox email → klik link konfirmasi
4. Link mengarah ke https://abcd1234.ngrok-free.app/verify-email/{token}
5. Berhasil → redirect ke dashboard
```

### Tips Ngrok Development

- URL ngrok berubah setiap kali restart (kecuali pakai plan berbayar dengan domain tetap)
- Setiap ganti URL ngrok, update `APP_URL` di `backend/.env` dan restart backend
- Gunakan `ngrok http 5173 --subdomain=rapatku` jika punya plan berbayar untuk URL tetap

---

## 5. Mode Production — 1 Perintah

Di mode production, backend Express sekaligus meng-host file statis frontend (`frontend/dist`). Tidak perlu Nginx atau menjalankan dev server frontend secara terpisah — cocok untuk server sederhana atau testing production di lokal.

### Cara Kerja

```
Browser → http://localhost:3001
           ├── /api/*   → Express routes (API)
           └── /*       → frontend/dist (React SPA)
```

### Langkah

```bash
# 1. Build frontend (sekali, atau setiap ada perubahan UI)
cd backend
npm run build:frontend
# Setara dengan: cd ../frontend && npm run build
```

```bash
# 2. Set NODE_ENV di backend/.env
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:3001   # sama dengan backend
APP_URL=http://localhost:3001
```

```bash
# 3. Jalankan satu perintah
cd backend
npm run server
```

Atau langsung tanpa ubah `.env`:

```bash
NODE_ENV=production npm run server
```

Output:
```
[PRODUCTION] Server berjalan di http://localhost:3001
Frontend served dari ../frontend/dist
```

Buka browser ke **http://localhost:3001** — frontend dan API berjalan di satu port.

### Kapan Pakai Mode Ini

| Skenario | Rekomendasi |
|----------|-------------|
| Development sehari-hari | Mode dev (2 terminal) |
| Testing production build di lokal | Mode production 1 perintah |
| Deploy ke VPS tanpa Nginx | Mode production 1 perintah + PM2 |
| Deploy ke VPS dengan domain + SSL | Mode production + Nginx (lihat bagian berikutnya) |

---

## 6. Deployment Production dengan Domain

### Asumsi Stack Production

- **Server**: VPS Ubuntu 22.04 (Contoh: DigitalOcean, Linode, AWS EC2)
- **Reverse Proxy**: Nginx
- **Process Manager**: PM2
- **SSL**: Let's Encrypt (Certbot)
- **Domain**: `yourdomain.com`

### A. Persiapan Server

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
```

### B. Setup Database Production

```bash
sudo -u postgres psql

-- Di dalam psql:
CREATE USER rapatku WITH PASSWORD 'password_aman_anda';
CREATE DATABASE meeting_manager OWNER rapatku;
GRANT ALL PRIVILEGES ON DATABASE meeting_manager TO rapatku;
\q

# Jalankan schema
psql -U rapatku -d meeting_manager -f /path/to/backend/database/schema.sql
```

### C. Deploy Aplikasi

```bash
# Upload kode ke server (gunakan scp, rsync, atau git clone)
git clone https://github.com/yourrepo/rapatku.git /var/www/rapatku

# Install dependencies backend
cd /var/www/rapatku/backend
npm install --production

# Build frontend
cd /var/www/rapatku/frontend
npm install
npm run build
# Output build ada di: /var/www/rapatku/frontend/dist
```

### D. Konfigurasi Environment Production

Buat `/var/www/rapatku/backend/.env`:

```env
# DATABASE
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meeting_manager
DB_USER=rapatku
DB_PASSWORD=password_aman_anda

# AUTH
JWT_SECRET=ganti_dengan_string_random_panjang_min_32_karakter

# URLS — ganti dengan domain Anda
PORT=3001
FRONTEND_URL=https://yourdomain.com
APP_URL=https://yourdomain.com

# GOOGLE SSO
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com

# EMAIL — RESEND
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com

# WHATSAPP — FONNTE (opsional)
FONNTE_TOKEN=your_fonnte_token
```

### E. Jalankan Backend dengan PM2

```bash
cd /var/www/rapatku/backend
pm2 start server.js --name rapatku-backend
pm2 save
pm2 startup  # Jalankan perintah yang muncul agar auto-start saat reboot
```

### F. Konfigurasi Nginx

Buat file `/etc/nginx/sites-available/rapatku`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Serve frontend build
    root /var/www/rapatku/frontend/dist;
    index index.html;

    # React Router — semua route arahkan ke index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy ke backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Keamanan — sembunyikan versi nginx
    server_tokens off;
}
```

```bash
# Aktifkan konfigurasi
sudo ln -s /etc/nginx/sites-available/rapatku /etc/nginx/sites-enabled/
sudo nginx -t  # Pastikan tidak ada error
sudo systemctl reload nginx
```

### G. Pasang SSL dengan Certbot

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot akan otomatis memperbarui konfigurasi Nginx dengan HTTPS. Cek auto-renewal:

```bash
sudo systemctl status certbot.timer
# Atau test renewal:
sudo certbot renew --dry-run
```

Setelah SSL terpasang, konfigurasi Nginx akan otomatis menjadi:
```
https://yourdomain.com → frontend (dist/)
https://yourdomain.com/api/* → backend (localhost:3001)
```

### H. Update Google OAuth untuk Production

Di Google Cloud Console, tambahkan ke **Authorized JavaScript Origins**:
```
https://yourdomain.com
https://www.yourdomain.com
```

### I. Setup Resend Domain (Email)

Agar email tidak masuk spam di production:

1. Login ke [resend.com](https://resend.com)
2. Navigasi ke **Domains → Add Domain**
3. Masukkan `yourdomain.com`
4. Tambahkan DNS records yang diberikan ke domain registrar Anda (TXT, MX records)
5. Tunggu verifikasi (biasanya 5-30 menit)
6. Gunakan `FROM_EMAIL=noreply@yourdomain.com` di `.env`

### J. Verifikasi Deployment

```bash
# Cek backend berjalan
pm2 status
pm2 logs rapatku-backend --lines 20

# Cek nginx
sudo systemctl status nginx

# Test endpoint health
curl https://yourdomain.com/api/health

# Monitor real-time
pm2 monit
```

---

## 7. Variabel Environment Lengkap

### backend/.env

| Variable | Development | Production | Keterangan |
|----------|-------------|------------|------------|
| `NODE_ENV` | `development` | `production` | Mode aplikasi; production = serve frontend dist |
| `DB_HOST` | `localhost` | `localhost` | Host database |
| `DB_PORT` | `5432` | `5432` | Port PostgreSQL |
| `DB_NAME` | `meeting_manager` | `meeting_manager` | Nama database |
| `DB_USER` | `postgres` | `rapatku` | User database |
| `DB_PASSWORD` | `password_lokal` | `password_aman` | Password DB |
| `JWT_SECRET` | bebas | min 32 karakter random | Secret untuk JWT |
| `PORT` | `3001` | `3001` | Port backend |
| `FRONTEND_URL` | `http://localhost:5173` atau URL ngrok | `http://localhost:3001` atau `https://yourdomain.com` | Untuk CORS (dev) / link email (prod) |
| `APP_URL` | `http://localhost:5173` atau URL ngrok | `https://yourdomain.com` | Untuk link di email |
| `GOOGLE_CLIENT_ID` | dari Google Cloud Console | sama | OAuth Client ID |
| `RESEND_API_KEY` | dari resend.com | dari resend.com | API key email |
| `FROM_EMAIL` | bebas | `noreply@yourdomain.com` | Alamat pengirim |
| `FONNTE_TOKEN` | opsional | opsional | Token WhatsApp |

### frontend/.env

| Variable | Development | Production | Keterangan |
|----------|-------------|------------|------------|
| `VITE_API_URL` | `http://localhost:3001` | tidak perlu (Nginx proxy) | URL backend API |
| `VITE_GOOGLE_CLIENT_ID` | dari Google Cloud Console | sama | OAuth Client ID |

> **Catatan Production:** Saat build frontend untuk production, `VITE_API_URL` tidak perlu diset karena request `/api/` sudah di-proxy oleh Nginx ke backend. Atau set ke `https://yourdomain.com`.

---

## 8. Migrasi Database

Jika tabel `users` sudah ada dari versi sebelumnya, jalankan SQL berikut:

```sql
-- Untuk Google SSO
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Untuk Email Verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;

-- Set semua user yang sudah ada sebagai verified
-- (agar tidak lock out user lama)
UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;

-- Set user Google otomatis verified
UPDATE users SET email_verified = TRUE WHERE google_id IS NOT NULL;
```

---

## Ringkasan Alur Autentikasi

```
Registrasi Email:
  Daftar → Email konfirmasi dikirim → Klik link → Akun aktif → Login

Login Email:
  Email + Password → Cek email_verified → Berhasil → Dashboard

Google SSO:
  Klik "Masuk dengan Google" → Popup Google → Akun auto-verified → Dashboard
```
