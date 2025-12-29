# Panduan Setup Google Service Account

Agar Vercel Cron bisa mengakses Spreadsheet Anda secara otomatis tanpa login manual, ikuti langkah-langkah berikut:

### 1. Buat Project di Google Cloud
1.  Buka [Google Cloud Console](https://console.cloud.google.com/).
2.  Buat project baru (misal: "InstaScheduler-Automation").
3.  Di menu sidebar, cari **APIs & Services > Library**.
4.  Cari **"Google Sheets API"** dan klik **Enable**.

### 2. Buat Service Account
1.  Buka menu **APIs & Services > Credentials**.
2.  Klik **Create Credentials** di bagian atas, pilih **Service Account**.
3.  Isi nama (misal: "scheduler-bot"), lalu klik **Create and Continue**.
4.  Klik **Done** (langkah Role bisa dilewati).

### 3. Download JSON Key
1.  Di daftar "Service Accounts", klik email akun yang baru dibuat.
2.  Buka tab **Keys**.
3.  Klik **Add Key > Create new key**.
4.  Pilih format **JSON**, lalu klik **Create**. File JSON akan terdownload ke komputer Anda.

### 4. Berikan Akses ke Spreadsheet
1.  Buka file JSON yang baru didownload, cari baris `"client_email"`. Copy alamat email tersebut (misal: `scheduler-bot@project-id.iam.gserviceaccount.com`).
2.  Buka Google Spreadsheet jadwal Anda.
3.  Klik tombol **Share** di pojok kanan atas.
4.  Paste email Service Account tadi, berikan akses sebagai **Editor**, lalu klik **Send**.

### 5. Pasang di Vercel
Buka Dashboard Vercel Anda, masuk ke **Settings > Environment Variables**, dan tambahkan variabel berikut:

| Key | Value |
| :--- | :--- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Paste seluruh isi file JSON tadi (termasuk tanda kurung kurawal `{}`) |
| `SPREADSHEET_ID` | ID Spreadsheet Anda |

**Selesai!** Sisanya (seperti Token Instagram dan ImageKit) akan otomatis dibaca oleh sistem dari tab **Settings** di Spreadsheet Anda. Jika Anda mengubah token di aplikasi, sistem otomatis akan langsung mengetahuinya.

