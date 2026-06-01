# RapatKu — Aplikasi Manajemen Rapat

Aplikasi full-stack untuk mengelola rapat dan kegiatan organisasi, lengkap dengan notifikasi Email dan WhatsApp.

## Fitur Utama

- **Manajemen Rapat**: Buat, edit, dan kelola jadwal rapat dengan detail lengkap
- **Agenda Rapat**: Susun agenda dengan PIC dan durasi per topik
- **Presensi Digital**: Link presensi yang bisa dibagikan, tidak perlu login
- **Notulen Rapat**: Buat dan edit notulen per agenda, dengan sistem persetujuan
- **Lock Notulen**: Notulen terkunci otomatis setelah semua peserta menyetujui
- **Notifikasi Email**: Undangan dan reminder via Resend
- **Notifikasi WhatsApp**: Undangan, reminder, dan pengingat agenda via Fonnte
- **Pencarian Lengkap**: Cari rapat berdasarkan topik, isi notulen, atau peserta
- **Autentikasi**: Login wajib untuk fitur utama, presensi bisa diakses publik

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + React Router
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Email**: Resend
- **WhatsApp**: Fonnte API

## Prasyarat

- Node.js 18+
- PostgreSQL 14+
- Akun Resend (https://resend.com) — opsional
- Akun Fonnte (https://fonnte.com) — opsional

---

## Cara Menjalankan

### 1. Clone & Setup

```bash
# Buka folder project
cd "Aplikasi Manage Meeting"
```

### 2. Setup Database

**Jika PostgreSQL berjalan lokal:**

```bash
psql -U postgres -c "CREATE DATABASE meeting_manager;"
psql -U postgres -d meeting_manager -f backend/database/schema.sql
```

**Jika PostgreSQL berjalan di Docker:**

```bash
# Ganti "some-postgres" dengan nama container PostgreSQL Anda
# Cek nama container: docker ps

# Buat database
docker exec some-postgres psql -U postgres -c "CREATE DATABASE meeting_manager;"

# Jalankan schema
docker exec -i some-postgres psql -U postgres -d meeting_manager < backend/database/schema.sql
```

> Pastikan container PostgreSQL sudah berjalan sebelum menjalankan perintah di atas (`docker ps`).
> Untuk koneksi dari backend ke PostgreSQL Docker, pastikan `DB_HOST=localhost` dan port container ter-expose ke host (misal: `-p 5432:5432`).

### 3. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Copy dan isi file .env
cp .env.example .env
# Edit .env sesuai konfigurasi database dan API key Anda

# Jalankan backend
npm run dev
```

### 4. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Jalankan frontend
npm run dev
```

### 5. Akses Aplikasi

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api

---

## Mode Production (1 Perintah)

Di mode production, backend sekaligus meng-host frontend — **tidak perlu menjalankan dev server frontend terpisah**.

### Langkah

```bash
# 1. Build frontend (lakukan sekali, atau setiap ada perubahan UI)
cd backend
npm run build:frontend

# 2. Set NODE_ENV=production di backend/.env
NODE_ENV=production

# 3. Jalankan satu perintah
npm run server
```

Atau tanpa ubah `.env`, langsung via environment variable:

```bash
NODE_ENV=production npm run server
```

Output saat berhasil:
```
[PRODUCTION] Server berjalan di http://localhost:3001
Frontend served dari ../frontend/dist
```

Akses aplikasi di: **http://localhost:3001** (satu port untuk segalanya)

### Perbedaan Development vs Production

| | Development | Production |
|---|---|---|
| Jalankan | 2 terminal (backend + frontend) | 1 perintah |
| Frontend port | `5173` | — (serve dari backend) |
| Backend port | `3001` | `3001` (frontend + API) |
| `NODE_ENV` | `development` | `production` |
| CORS | aktif | tidak diperlukan (same-origin) |

---

## Konfigurasi .env Backend

```env
# Mode (development | production)
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meeting_manager
DB_USER=postgres
DB_PASSWORD=password_anda

# JWT (ganti dengan string random yang panjang)
JWT_SECRET=random_secret_string_panjang

# URLs
PORT=3001
FRONTEND_URL=http://localhost:5173   # dev: port 5173 | production: port 3001
APP_URL=http://localhost:5173

# Email via Resend (opsional)
RESEND_API_KEY=re_xxxxxx
FROM_EMAIL=rapat@domain-anda.com

# WhatsApp via Fonnte (opsional)
FONNTE_TOKEN=token_fonnte_anda
```

> Jika `RESEND_API_KEY` atau `FONNTE_TOKEN` tidak diisi, sistem akan berjalan dalam mode simulasi (notifikasi akan di-log di console, tidak benar-benar dikirim).

---

## Cara Daftar Fonnte (WhatsApp)

1. Daftar di https://fonnte.com
2. Hubungkan nomor WhatsApp Anda
3. Salin token API ke `.env` sebagai `FONNTE_TOKEN`

## Cara Daftar Resend (Email)

1. Daftar di https://resend.com
2. Verifikasi domain email Anda
3. Buat API key dan salin ke `.env` sebagai `RESEND_API_KEY`

---

## Struktur Project

```
Aplikasi Manage Meeting/
├── backend/
│   ├── database/
│   │   └── schema.sql          # DDL schema PostgreSQL
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js           # Koneksi PostgreSQL
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT middleware
│   │   ├── routes/
│   │   │   ├── auth.js         # Login, register, profil
│   │   │   ├── meetings.js     # CRUD rapat + notifikasi
│   │   │   ├── agendas.js      # CRUD agenda
│   │   │   ├── attendance.js   # Presensi (public)
│   │   │   ├── minutes.js      # Notulen + persetujuan
│   │   │   └── users.js        # Pencarian user + statistik
│   │   └── services/
│   │       ├── emailService.js    # Resend email
│   │       └── whatsappService.js # Fonnte WhatsApp
│   ├── server.js               # Entry point
│   └── .env.example
└── frontend/
    └── src/
        ├── api/axios.js        # Axios instance
        ├── context/AuthContext.jsx
        ├── components/
        │   ├── Layout.jsx      # Sidebar + navbar
        │   └── MeetingCard.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── DashboardPage.jsx
            ├── ProfilePage.jsx
            ├── MeetingCreatePage.jsx
            ├── MeetingDetailPage.jsx
            ├── MeetingEditPage.jsx
            ├── MeetingMinutesPage.jsx
            ├── AttendancePage.jsx  # Public (tanpa login)
            └── SearchPage.jsx
```

---

## Alur Penggunaan

1. **Daftar & Login** → lengkapi profil (wajib)
2. **Buat Rapat** → isi judul, tanggal, peserta, dan agenda
3. **Kirim Undangan** → notifikasi email & WhatsApp ke peserta
4. **Bagikan Link Presensi** → peserta isi tanpa login
5. **Saat Rapat** → update status ke "Berlangsung"
6. **Pasca Rapat** → buat notulen per agenda
7. **Review Notulen** → kirim notifikasi ke peserta untuk menyetujui
8. **Lock Otomatis** → setelah semua setuju, notulen terkunci

---

*Dibuat dengan RapatKu — Sistem Manajemen Rapat Modern*
