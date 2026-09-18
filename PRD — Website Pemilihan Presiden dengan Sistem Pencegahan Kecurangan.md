# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1. Informasi Produk

**Nama Produk:** E-PRESIDEN  
**Jenis Produk:** Website simulasi pemilihan presiden / e-voting  
**Platform:** Web Desktop & Mobile  
**Bahasa:** Bahasa Indonesia  

### Tujuan Produk

Membangun website pemilihan presiden yang memungkinkan pengguna melakukan simulasi pemungutan suara secara digital dengan mekanisme yang dirancang untuk mendeteksi dan mencegah berbagai bentuk kecurangan.

Website harus mengutamakan:
- Kerahasiaan suara
- Satu pemilih satu suara
- Integritas data
- Transparansi proses
- Auditabilitas
- Keamanan akun
- Deteksi aktivitas mencurigakan

> Produk ini ditujukan sebagai sistem simulasi/prototipe dan bukan sistem resmi untuk menyelenggarakan pemilu nasional tanpa sertifikasi, audit keamanan, dan persetujuan regulator yang relevan.

---

# 2. Masalah yang Ingin Diselesaikan

Sistem pemilihan digital dapat menghadapi beberapa risiko, antara lain:

### A. Suara Ganda
Seorang pemilih mencoba memberikan suara lebih dari satu kali.

**Solusi:**
- Setiap pemilih memiliki identitas unik.
- Database menggunakan constraint untuk mencegah vote ganda.
- Backend selalu melakukan pengecekan status voting.

### B. Manipulasi Hasil
Data jumlah suara dapat berubah secara tidak sah.

**Solusi:**
- Batasi akses database.
- Gunakan role-based access control.
- Simpan audit log.
- Catat perubahan data penting.
- Sediakan mekanisme verifikasi hasil.

### C. Akses Akun Tidak Sah
Orang lain mencoba menggunakan akun pemilih.

**Solusi:**
- Password di-hash menggunakan bcrypt/Argon2.
- Session authentication.
- Rate limiting pada login.
- Logout otomatis setelah periode tertentu.
- Catat aktivitas login yang mencurigakan.

### D. Manipulasi Data Kandidat
Informasi kandidat dapat diubah tanpa izin.

**Solusi:**
- Hanya admin berwenang yang dapat mengubah data.
- Setiap perubahan dicatat dalam audit log.
- Simpan timestamp perubahan.

### E. Serangan pada API
Pengguna mencoba memanggil API secara langsung untuk memanipulasi voting.

**Solusi:**
- Semua endpoint sensitif harus melakukan validasi server-side.
- Jangan mempercayai data dari frontend.
- Gunakan authentication dan authorization middleware.
- Validasi parameter dan request body.

### F. Kurangnya Transparansi
Pengguna tidak mengetahui bagaimana hasil diperoleh.

**Solusi:**
- Tampilkan statistik partisipasi.
- Tampilkan waktu mulai dan selesai.
- Publikasikan hasil setelah pemilihan selesai.
- Sediakan ringkasan audit yang tidak membocorkan identitas pemilih.

---

# 3. Target Pengguna

## Pemilih

Dapat:
- Login
- Melihat kandidat
- Membaca visi dan misi
- Memberikan satu suara
- Melihat status bahwa suara telah tercatat

## Administrator

Dapat:
- Mengelola kandidat
- Mengelola pemilih
- Mengatur jadwal
- Memantau partisipasi
- Melihat hasil
- Melihat audit log
- Meninjau aktivitas mencurigakan

## Auditor

Role khusus untuk memeriksa:
- Audit log
- Integritas hasil
- Aktivitas sistem
- Perubahan konfigurasi

Auditor tidak dapat mengubah suara.

---

# 4. User Flow

## Pemilih

Landing Page  
↓  
Login  
↓  
Verifikasi akun  
↓  
Daftar Kandidat  
↓  
Pilih Kandidat  
↓  
Konfirmasi  
↓  
Suara Dicatat  
↓  
Status "Sudah Memilih"  
↓  
Logout

## Admin

Login Admin  
↓  
Dashboard  
↓  
Monitoring  
↓  
Kelola Kandidat / Pemilih / Pemilihan  
↓  
Audit Log  
↓  
Hasil Pemilihan

---

# 5. Halaman Website

## Landing Page

Menampilkan:
- Nama pemilihan
- Informasi pemilihan
- Jadwal
- Status pemilihan
- Jumlah pemilih terdaftar
- Persentase partisipasi
- Tombol login

---

## Login

Input:
- ID Pemilih
- Password

Fitur:
- Validasi
- Rate limiting
- Pesan error
- Session

---

## Kandidat

Setiap kandidat memiliki:
- Foto
- Nomor urut
- Nama
- Visi
- Misi
- Program kerja

---

## Voting

Pengguna hanya dapat memilih satu kandidat.

Sebelum dikirim:

**"Pastikan pilihan Anda sudah benar. Setelah dikonfirmasi, suara tidak dapat diubah."**

---

# 6. Anti-Fraud System

Buat modul khusus:

## Fraud Detection Dashboard

Admin dapat melihat:

- Percobaan login berulang
- Banyak login dari akun berbeda pada pola waktu yang tidak wajar
- Percobaan voting berulang
- Request API yang tidak normal
- Perubahan data administratif
- Percobaan akses endpoint tanpa izin

Setiap aktivitas diberikan:

- ID aktivitas
- Jenis aktivitas
- Waktu
- User terkait jika relevan
- Status
- Tingkat risiko

Gunakan kategori:

**Normal**
**Perlu Ditinjau**
**Mencurigakan**

Jangan otomatis menyimpulkan bahwa suatu aktivitas merupakan kecurangan hanya berdasarkan satu indikator. Sediakan status "perlu ditinjau" agar admin/auditor dapat melakukan pemeriksaan.

---

# 7. Audit Log

Setiap aktivitas penting dicatat.

Contoh:

```text
LOGIN_SUCCESS
LOGIN_FAILED
VOTE_CAST
DUPLICATE_VOTE_BLOCKED
ADMIN_LOGIN
CANDIDATE_UPDATED
VOTER_UPDATED
ELECTION_SETTING_CHANGED
SUSPICIOUS_ACTIVITY_DETECTED
```

Data log:

- ID
- Event
- User ID jika relevan
- Timestamp
- Metadata teknis seperlunya
- Result

Audit log harus bersifat append-only bagi administrator biasa.

---

# 8. Integritas Hasil

Sistem harus menyediakan mekanisme untuk memastikan hasil yang ditampilkan berasal dari data suara yang tercatat.

Implementasi prototipe:

- Setiap vote memiliki ID unik.
- Database menggunakan transaction saat menyimpan suara.
- Gunakan constraint untuk mencegah duplicate vote.
- Hasil dihitung langsung dari database.
- Simpan snapshot hasil ketika pemilihan ditutup.
- Catat siapa yang melakukan tindakan administratif.

Untuk sistem produksi, tambahkan audit keamanan independen dan mekanisme verifikasi kriptografis yang sesuai dengan standar pemilu.

---

# 9. Kerahasiaan Suara

Identitas pemilih tidak boleh ditampilkan bersama pilihannya kepada pengguna biasa.

Pisahkan:
- Data autentikasi pemilih
- Data suara
- Data hasil agregat

Tujuan:
Admin dapat mengetahui apakah seseorang sudah memilih, tetapi tidak dapat melihat pilihan individualnya melalui UI biasa.

---

# 10. Database

### users

```text
id
voter_id
name
password_hash
role
has_voted
created_at
```

### candidates

```text
id
candidate_number
name
photo
vision
mission
programs
created_at
updated_at
```

### votes

```text
id
candidate_id
vote_token
created_at
```

### election_settings

```text
id
name
start_time
end_time
status
created_at
updated_at
```

### audit_logs

```text
id
event_type
user_id
metadata
created_at
```

### fraud_events

```text
id
event_type
severity
description
status
created_at
reviewed_at
reviewed_by
```

---

# 11. Role & Permission

| Fitur | Pemilih | Admin | Auditor |
|---|---:|---:|---:|
| Login | ✓ | ✓ | ✓ |
| Melihat kandidat | ✓ | ✓ | ✓ |
| Voting | ✓ | - | - |
| Kelola kandidat | - | ✓ | - |
| Kelola pemilih | - | ✓ | - |
| Lihat hasil | Sesuai aturan pemilihan | ✓ | ✓ |
| Audit log | - | ✓ | ✓ |
| Review aktivitas mencurigakan | - | ✓ | ✓ |
| Mengubah vote | - | - | - |

Tidak ada role yang dapat mengubah suara yang sudah diberikan melalui dashboard.

---

# 12. Security Requirements

Wajib:

- Password hashing
- Session security
- HTTPS untuk deployment
- CSRF protection
- Rate limiting
- Input validation
- SQL injection protection
- XSS protection
- Authentication
- Authorization
- Secure cookies
- Database access control
- Audit logging
- Backup database
- Error handling tanpa membocorkan informasi sensitif

Jangan menyimpan:
- Password plaintext
- Secret key di source code
- Informasi autentikasi di frontend

Gunakan `.env` untuk secret/configuration.

---

# 13. Dashboard Hasil

Setelah pemilihan selesai:

```text
KANDIDAT 01    █████████████  45%
KANDIDAT 02    █████████       30%
KANDIDAT 03    ██████          25%
```

Tampilkan:
- Total suara
- Total pemilih
- Jumlah yang memilih
- Jumlah yang tidak memilih
- Persentase partisipasi
- Status pemilihan

Jangan menampilkan informasi yang dapat mengungkap pilihan individual pemilih.

---

# 14. Acceptance Criteria

### Voting

- Pemilih yang belum memilih dapat memberikan suara.
- Pemilih hanya dapat memilih satu kandidat.
- Vote kedua harus ditolak oleh backend.
- Vote berhasil harus tersimpan secara atomik.
- Setelah voting, status pemilih berubah menjadi sudah memilih.

### Security

- User biasa tidak dapat mengakses dashboard admin.
- Admin tidak dapat mengubah vote melalui UI.
- Password tidak pernah disimpan plaintext.
- Request tidak sah ditolak.

### Anti-Fraud

- Percobaan vote kedua dicatat.
- Login gagal berulang dapat ditandai untuk review.
- Perubahan data administratif dicatat.
- Aktivitas mencurigakan muncul di dashboard.
- Sistem tidak secara otomatis menyatakan seseorang melakukan kecurangan hanya berdasarkan sinyal teknis.

### Results

- Hasil dihitung dari database.
- Total suara harus konsisten dengan data voting.
- Hasil final hanya dapat dipublikasikan sesuai status pemilihan.
- Perubahan administratif tercatat dalam audit log.

---

# 15. Teknologi yang Disarankan

Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Node.js
- Express.js

Database:
- PostgreSQL atau SQLite untuk prototype

Security:
- Argon2/bcrypt
- express-session
- Helmet
- CSRF protection
- Rate limiter

Visualization:
- Chart.js

Deployment:
- HTTPS
- Environment variables
- Database backup

---

# 16. Prinsip Utama Produk

Website harus menerapkan prinsip:

**"Satu pemilih, satu suara, suara rahasia, hasil dapat diaudit."**

Sistem tidak boleh dirancang untuk menguntungkan kandidat tertentu. Semua kandidat harus mendapatkan perlakuan yang sama dari sisi tampilan, informasi, dan mekanisme voting.

Prioritaskan keamanan, transparansi, aksesibilitas, dan integritas data dibandingkan animasi atau fitur visual yang tidak penting.