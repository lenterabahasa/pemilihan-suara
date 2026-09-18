# E-PRESIDEN — Platform Simulasi Pemilihan Presiden dengan Sistem Pencegahan Kecurangan

Sistem simulasi pemungutan suara elektronik (e-voting) berbasis web yang dirancang dengan mekanisme pertahanan berlapis untuk mendeteksi, mencegah, dan mengaudit kecurangan pemilu secara transparan dan akuntabel.

Dikembangkan berdasarkan spesifikasi resmi pada:
> **[PRD — Website Pemilihan Presiden dengan Sistem Pencegahan Kecurangan.md](file:///c:/Users/win-10/Desktop/lentera%20bahasa/PRD%20%E2%80%94%20Website%20Pemilihan%20Presiden%20dengan%20Sistem%20Pencegahan%20Kecurangan.md)**

---

## 🏛️ Prinsip Utama Produk
> **"Satu pemilih, satu suara, suara rahasia, hasil dapat diaudit."**

1. **Kerahasiaan Suara (Secret Ballot)**: Identitas pemilih dan pilihan suara dipisahkan secara arsitektural di database. Tabel `votes` **tidak memiliki foreign key atau kolom `user_id`**. Pilihan pemilih disimpan sebagai token anonim kriptografis.
2. **Satu Pemilih Satu Suara (Atomic Transaction)**: Pemungutan suara diproses menggunakan transaksi atomik (ACID). Begitu suara tercatat di tabel `votes`, status `users.has_voted` diubah menjadi `1`. Upaya memberikan suara kedua diblokir di tingkat backend dan memicu peringatan kecurangan.
3. **Pusat Deteksi Kecurangan (Anti-Fraud Center)**:
   - Pemantauan otomatis serangan brute force pada login (klasifikasi risiko *Review* dan *Suspicious*).
   - Pemblokiran dan pencatatan otomatis atas percobaan suara ganda (*Duplicate Vote Attempt*).
   - Pencegahan manipulasi otorisasi dan eskalasi hak akses (*Privilege Escalation*).
   - Dashboard Anti-Fraud untuk Administrator & Auditor dengan status alur kerja: *Belum Ditinjau*, *Investigasi*, *Selesai*, dan *Ditolak*.
4. **Audit Log Kriptografis Berantai (Hash Chaining)**:
   - Log bersifat *append-only*.
   - Setiap entri log memiliki tanda tangan `log_hash = SHA256(previous_hash + id + event + timestamp + metadata)`.
   - Tombol verifikasi integritas kriptografis memungkinkan Auditor memeriksa seluruh rantai log dalam 1-klik untuk membuktikan tidak ada data yang dimanipulasi secara ilegal.
5. **Transparansi Hasil & Snapshot Integritas**:
   - Visualisasi hasil resmi menggunakan grafik perolehan suara (Chart.js) dan meter partisipasi pemilih.
   - Fitur pembekuan hasil (*Snapshot Hasil*) dengan tanda tangan digital SHA-256 saat pemilihan resmi ditutup.

---

## 👥 Akun Simulasi Pengujian (Demo Quick-Login)

Untuk kemudahan pengujian, pada halaman `/login.html` telah disediakan tombol jalan pintas (1-klik isi) untuk peran:

| Peran | ID Pemilih / Username | Password | Keterangan |
|---|---|---|---|
| **Pemilih (Belum Memilih)** | `pemilih01` | `voter123` | Dapat memilih salah satu paslon di bilik suara |
| **Pemilih (Sudah Memilih)** | `pemilih02` | `voter123` | Memiliki status sudah memilih & tanda terima digital |
| **Administrator** | `admin` | `admin123` | Akses penuh dashboard kendali, kelola pemilih & fraud |
| **Auditor Independen** | `auditor` | `auditor123` | Hak read-only untuk audit log & verifikasi kriptografis |

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Menjalankan Server
```powershell
npm start
```
Akses aplikasi melalui peramban: **[http://localhost:3000](http://localhost:3000)**

### 2. Menjalankan Test Suite Otomatis
```powershell
npm test
```
Menguji 8 skenario krusial:
- Kerahasiaan suara (tabel `votes` bebas identitas pengguna)
- Transaksi atomik satu suara
- Pencegahan dan pencatatan suara ganda
- Deteksi brute force login
- Konsistensi data suara masuk vs status pemilih
- Verifikasi rantai hash kriptografis
- Deteksi manipulasi ilegal (*tamper detection*)
- Pembuatan snapshot hasil resmi

### 3. Mereset Basis Data ke Kondisi Awal
```powershell
npm run seed
```

---

## 📂 Struktur Proyek
```
lentera bahasa/
├── src/
│   ├── config.js              # Konfigurasi aplikasi & port
│   ├── server.js              # Server Express & middleware keamanan
│   ├── db/
│   │   ├── db.js              # Node.js native sqlite connection manager
│   │   ├── schema.js          # Skema database SQLite sesuai PRD
│   │   └── seed.js            # Seeder data paslon, pemilih, dan log awal
│   ├── middleware/
│   │   ├── auth.js            # Autentikasi sesi & Role-Based Access Control
│   │   ├── csrf.js            # Validasi proteksi token CSRF
│   │   └── rateLimiter.js     # Pembatas laju request anti brute-force
│   ├── routes/
│   │   ├── authRoutes.js      # Endpoint login, logout, sesi, & csrf
│   │   ├── votingRoutes.js    # Endpoint bilik suara, cast vote, & rekapitulasi
│   │   ├── adminRoutes.js     # Endpoint kelola pemilih, pengaturan, & fraud review
│   │   └── auditRoutes.js     # Endpoint audit log & verifikasi kriptografis
│   └── services/
│       ├── antiFraudService.js # Mesin deteksi kecurangan & mitigasi anomali
│       ├── auditService.js     # Hash chained logger & verifikator integritas
│       └── votingService.js    # Logika transaksi atomik & snapshot hasil
├── public/                    # Frontend Web Responsif
│   ├── index.html             # Landing page informatif & partisipasi
│   ├── login.html             # Formulir login dengan demo presets
│   ├── bilik-suara.html       # Bilik suara digital & tanda terima pemilu
│   ├── admin.html             # Dashboard Admin & Anti-Fraud Center
│   ├── auditor.html           # Portal Auditor Independen
│   ├── hasil.html             # Halaman visualisasi rekapitulasi hasil
│   ├── css/style.css          # Design system civic elegan & responsif
│   ├── js/api.js              # Client API helper dengan CSRF & sesi
│   └── img/                   # Logo & ilustrasi SVG kandidat
├── test/
│   ├── test-system.js         # Suite pengujian otomatis 8 skenario PRD
│   └── test-http.js           # Pengujian HTTP endpoint
├── package.json
└── README.md
```

---
*Catatan Hukum: Produk ini dirancang sebagai sistem simulasi dan prototipe pembelajaran e-voting berintegritas, bukan untuk menyelenggarakan pemilu nasional tanpa sertifikasi dan pengesahan dari regulator yang berwenang.*
