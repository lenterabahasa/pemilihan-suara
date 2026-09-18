# E-PRESIDEN — Platform Simulasi Pemilihan Presiden dengan Sistem Pencegahan Kecurangan (Pure Frontend)

Website simulasi pemungutan suara elektronik (e-voting) berbasis **Pure Frontend (Client-Side Only)** yang dirancang dengan mekanisme pertahanan berlapis untuk mendeteksi, mencegah, dan mengaudit kecurangan pemilu secara transparan dan akuntabel langsung di peramban (browser).

Dikembangkan berdasarkan spesifikasi resmi pada:
> **[PRD — Website Pemilihan Presiden dengan Sistem Pencegahan Kecurangan.md](file:///c:/Users/win-10/Desktop/lentera%20bahasa/PRD%20%E2%80%94%20Website%20Pemilihan%20Presiden%20dengan%20Sistem%20Pencegahan%20Kecurangan.md)**

---

## 🏛️ Prinsip Utama Produk
> **"Satu pemilih, satu suara, suara rahasia, hasil dapat diaudit."**

1. **Kerahasiaan Suara (Secret Ballot)**: Identitas pemilih dan pilihan suara dipisahkan secara arsitektural. Tabel `votes` pada `localStorage` **tidak memiliki `user_id` atau `voter_id`**. Pilihan pemilih disimpan sebagai token anonim kriptografis (`VOTE-...`).
2. **Satu Pemilih Satu Suara**: Begitu suara tercatat di tabel `votes`, status `users.has_voted` dikunci menjadi `1`. Upaya memberikan suara kedua seketika digagalkan dan memicu peringatan kecurangan.
3. **Pusat Deteksi Kecurangan (Anti-Fraud Center)**:
   - Pemantauan otomatis upaya brute force pada login (klasifikasi risiko *Review* dan *Suspicious*).
   - Pemblokiran dan pencatatan otomatis atas percobaan suara ganda (*Duplicate Vote Attempt*).
   - Pencegahan manipulasi otorisasi dan eskalasi hak akses (*Privilege Escalation*).
   - Dashboard Anti-Fraud untuk Administrator & Auditor dengan status alur kerja: *Belum Ditinjau*, *Investigasi*, *Selesai*, dan *Ditolak*.
4. **Audit Log Kriptografis Berantai (Hash Chaining)**:
   - Log bersifat *append-only*.
   - Setiap entri log memiliki tanda tangan `log_hash = SHA256(previous_hash + id + event + timestamp + metadata)` menggunakan **Web Crypto API**.
   - Tombol verifikasi integritas kriptografis memungkinkan Auditor memeriksa seluruh rantai log dalam 1-klik untuk membuktikan tidak ada data yang dimanipulasi secara ilegal.
5. **Transparansi Hasil & Snapshot Integritas**:
   - Visualisasi hasil resmi menggunakan grafik perolehan suara (Chart.js) dan meter partisipasi pemilih.
   - Fitur pembekuan hasil (*Snapshot Hasil*) dengan tanda tangan digital SHA-256 saat pemilihan resmi ditutup.

---

## 👥 Akun Simulasi Pengujian (Demo Quick-Login)

Untuk kemudahan pengujian, pada halaman `login.html` telah disediakan tombol jalan pintas (1-klik isi) untuk peran:

| Peran | ID Pemilih / Username | Password | Keterangan |
|---|---|---|---|
| **Pemilih (Belum Memilih)** | `pemilih01` | `voter123` | Dapat memilih salah satu paslon di bilik suara |
| **Pemilih (Sudah Memilih)** | `pemilih02` | `voter123` | Memiliki status sudah memilih & tanda terima digital |
| **Administrator** | `admin` | `admin123` | Akses penuh dashboard kendali, kelola pemilih & fraud |
| **Auditor Independen** | `auditor` | `auditor123` | Hak read-only untuk audit log & verifikasi kriptografis |

---

## 🚀 Cara Menjalankan & Membuka Aplikasi

Karena aplikasi ini murni frontend (HTML, CSS, JS), Anda dapat membukanya dengan cara:

### Cara 1: Buka Langsung File HTML di Browser
Cukup klik dua kali (double click) file **`index.html`** di Windows Explorer, atau klik kanan lalu pilih **Open with Google Chrome / Microsoft Edge**.

### Cara 2: Menggunakan Static Web Server (Opsional)
Jika Anda menggunakan extension seperti **VS Code Live Server**, atau CLI static server:
```powershell
npx serve .
# atau
python -m http.server 3000
```
Lalu buka peramban di `http://localhost:3000`.

---

## 📂 Struktur Berkas Pure Frontend
```
lentera bahasa/
├── index.html             # Landing page informatif & partisipasi
├── login.html             # Formulir login dengan demo presets
├── bilik-suara.html       # Bilik suara digital & tanda terima pemilu
├── admin.html             # Dashboard Admin & Anti-Fraud Center
├── auditor.html           # Portal Auditor Independen
├── hasil.html             # Halaman visualisasi rekapitulasi hasil (Chart.js)
├── 404.html               # Halaman 404
├── css/
│   └── style.css          # Design system civic modern & responsif
├── js/
│   ├── store.js           # Client-side store (localStorage & Web Crypto SHA-256)
│   └── api.js             # Client API adapter
├── img/
│   ├── logo.svg           # Logo resmi E-Presiden
│   ├── paslon1.svg        # Pasangan Calon 01
│   ├── paslon2.svg        # Pasangan Calon 02
│   └── paslon3.svg        # Pasangan Calon 03
├── PRD — Website Pemilihan Presiden dengan Sistem Pencegahan Kecurangan.md
└── README.md
```

---
*Catatan: Anda dapat menekan tombol **"🔄 Reset Data Simulasi"** di bagian footer pada halaman mana pun untuk mengembalikan data pengujian ke kondisi awal kapan saja.*
