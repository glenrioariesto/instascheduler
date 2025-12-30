# Instascheduler

A personal Instagram scheduler that automates posting using Google Sheets as a database and ImageKit for media storage.

## 🚀 Features

- **Database**: Uses Google Sheets to manage scheduled posts (dates, captions, media URLs).
- **Storage**: Uses ImageKit.io to host images and videos for reliable delivery.
- **Automation**: Automatically uploads content to Instagram using the Instagram Graph API.
- **Multi-Account**: Supports multiple Instagram profiles with independent schedules.
- **Media Support**: Supports single images, videos, and carousel posts.
- **Manual Post**: Ability to post immediately from the dashboard.

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite), TypeScript, TailwindCSS, Lucide React.
- **Backend**: Vercel Serverless Functions (API), Vercel Cron Jobs.
- **State Management**: Zustand.
- **APIs**: Google Sheets API, Instagram Graph API, ImageKit API.

---

## 📂 Project Structure

```text
├── api/                # Vercel Serverless Functions
│   ├── cron/           # Automation scripts (Cron Jobs)
│   └── sheets/         # Google Sheets API proxy
├── components/         # React Components
│   ├── scheduler/      # Calendar and scheduling UI
│   ├── Settings.tsx    # Configuration management
│   └── PostForm.tsx    # Manual & Scheduled post creator
├── services/           # API Service layers (Instagram, Sheets, ImageKit)
├── store/              # Zustand store for global state
├── types.ts            # TypeScript interfaces and enums
└── utils/              # Helper functions
```

---

## 🔄 How It Works (Alur Kerja)

1.  **Configuration**: Pengguna memasukkan kredensial (Instagram, ImageKit, Google Sheet) di halaman **Settings**. Data ini disimpan langsung ke Google Sheet.
2.  **Scheduling**: Pengguna membuat post melalui **Manual Post** atau mengisi baris baru di Google Sheet.
3.  **Automation**: Vercel Cron Job berjalan secara periodik (misal: setiap jam) memanggil endpoint `/api/cron/post`.
4.  **Processing**:
    - Script membaca tab `Profiles` untuk daftar akun.
    - Untuk setiap akun, script mengecek tab `Schedules` terkait.
    - Jika ada post yang statusnya bukan `published` dan waktunya sudah lewat, script akan memprosesnya.
5.  **Publishing**: Media di-upload ke Instagram (via URL ImageKit), lalu di-publish.
6.  **Reporting**: Status di Google Sheet diupdate menjadi `published` (atau `failed` jika gagal).

---

## 📖 Setup Guide (Panduan Setup)

### 1. Google Sheets & Service Account (Global)
1.  **Google Cloud Project**: Buat project di [Google Cloud Console](https://console.cloud.google.com/) dan aktifkan **Google Sheets API**.
2.  **Service Account**: Buat Service Account di menu **Credentials**, download **JSON Key**.
3.  **Share Spreadsheet**: Buat Google Spreadsheet, copy **ID**-nya, dan **Share** ke email Service Account sebagai **Editor**.

### 2. Instagram Graph API (Per Profile)
1.  **Meta App**: Buat App tipe **Business** di [Meta for Developers](https://developers.facebook.com/).
2.  **Token**: Ambil **Long-Lived Access Token** (60 hari) melalui Graph Explorer dan Access Token Tool.
3.  **Permissions**: Pastikan memiliki `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `business_management`.

### 3. ImageKit Setup (Per Profile)
1.  Daftar di [ImageKit.io](https://imagekit.io/).
2.  Ambil **URL Endpoint**, **Public Key**, dan **Private Key** dari menu **Developer Options**.

---

## 🚀 Deployment (Vercel)

Tambahkan Environment Variables berikut di Vercel:

| Key | Value |
| :--- | :--- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Seluruh isi file JSON Service Account |
| `SPREADSHEET_ID` | ID Spreadsheet utama Anda |
| `CRON_SECRET` | (Opsional) Secret key untuk mengamankan endpoint cron |

---

## ❓ Troubleshooting (Masalah Umum)

-   **Post Tidak Terbit**: Pastikan waktu di Google Sheet menggunakan format ISO atau format yang valid, dan statusnya bukan `published`.
-   **Error ImageKit**: Pastikan Private Key benar. ImageKit dibutuhkan karena Instagram memerlukan URL publik yang valid untuk menarik media.
-   **Token Expired**: Instagram Long-lived token berlaku 60 hari. Anda perlu memperbaruinya secara berkala di halaman Settings.
-   **Tab Tidak Ditemukan**: Klik tombol **Initialize** di halaman Settings untuk memastikan semua tab (`Profiles`, `Schedules`, `Logs`) sudah dibuat dengan benar.
