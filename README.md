# Inheritance — Digital Legacy Vault

Platform penyimpanan wasiat digital yang menggunakan enkripsi berlapis dan penyimpanan permanen di Arweave blockchain. Pengguna bisa membuat, mengelola, dan mewariskan dokumen penting kepada ahli waris dengan keamanan kriptografi tingkat militer.

---

## Daftar Isi

- [Arsitektur](#arsitektur)
- [Tech Stack](#tech-stack)
- [Enkripsi & Keamanan](#enkripsi--keamanan)
- [Alur Penggunaan](#alur-penggunaan)
- [Setup & Menjalankan](#setup--menjalankan)
- [Variabel Lingkungan](#variabel-lingkungan)
- [API Endpoints](#api-endpoints)
- [FAQ](#faq)

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / Client                      │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP :7000
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Nginx Reverse Proxy                     │
│  /        → frontend:7001                               │
│  /api/v1/ → backend:7002                                │
└───────────┬─────────────────────────┬───────────────────┘
            │                         │
            ▼                         ▼
┌───────────────────┐     ┌───────────────────────────────┐
│  Frontend         │     │  Backend                      │
│  Next.js (App     │     │  Express.js + TypeScript      │
│  Router)          │     │                               │
│  Port: 7001       │     │  Port: 7002                   │
│                   │     │  - Vault CRUD                 │
│  - Wizard UI      │     │  - Shamir key splitting       │
│  - AI Chat        │     │  - Arweave upload relay       │
│  - Client-side    │     │  - RAG (vault docs)           │
│    encryption     │     │  - Security Q&A verify        │
└───────────────────┘     └───────────────────────────────┘
            │                         │
            ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│               Arweave Network (arweave.net)              │
│     Encrypted vault payload disimpan permanen           │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend framework | Next.js 14 (App Router, TypeScript) |
| Backend framework | Express.js (TypeScript, ESM) |
| AI Chat | DeepSeek API via Vercel AI SDK |
| Wallet (Arweave) | Wander Wallet (extension + WanderConnect SDK) |
| Blockchain storage | Arweave |
| Client encryption | Web Crypto API, @noble/hashes |
| PQC | ML-KEM-768 (FIPS 203) |
| Key splitting | Shamir's Secret Sharing (secrets.js-grempe) |
| Time-lock | Drand + tlock-js |
| Schema validation | Zod |
| Logging | Pino |
| Reverse proxy | Nginx |
| Container | Docker + Docker Compose |
| MCP Server | Model Context Protocol (AI tool integration) |

---

## Enkripsi & Keamanan

Vault dienkripsi sepenuhnya di sisi klien sebelum dikirim ke backend. Backend **tidak pernah** melihat data plain-text vault.

### Lapisan Enkripsi

```
Data Vault (plain-text)
        │
        ▼ Layer 1
┌───────────────────────────────────────┐
│  AES-256-GCM                         │
│  Key: random 32-byte vault key       │
│  → Encrypted vault payload           │
└───────────────────────────────────────┘
        │
        ▼ Layer 2
┌───────────────────────────────────────┐
│  ML-KEM-768 (Post-Quantum, FIPS 203) │
│  - Generate PQC key pair             │
│  - Encapsulate vault key dengan      │
│    PQC public key                    │
│  - PQC ciphertext disimpan di vault  │
└───────────────────────────────────────┘
        │
        ▼ Layer 3
┌───────────────────────────────────────┐
│  Shamir's Secret Sharing (3-of-5)    │
│  - PQC secret key dipecah 5 bagian   │
│  - Min 3 dari 5 fraction key         │
│    diperlukan untuk membuka vault    │
└───────────────────────────────────────┘
        │
        ▼ Layer 4
┌───────────────────────────────────────┐
│  Arweave Blockchain Storage          │
│  - Encrypted payload disimpan        │
│    permanen dan immutable            │
└───────────────────────────────────────┘
```

### Time-Lock (Trigger Release)

Untuk vault dengan trigger tanggal spesifik, vault key di-seal dengan **Drand time-lock encryption** menggunakan `tlock-js`. Vault hanya bisa dibuka setelah ronde Drand yang sesuai dengan tanggal tersebut tercapai.

### Security Questions

Jawaban security question di-hash dengan SHA-256 (setelah normalisasi NFKC + lowercase + trim) sebelum disimpan. Verifikasi dilakukan dengan membandingkan hash, bukan plain-text.

---

## Alur Penggunaan

### 1. Membuat Vault (Create)

```
Step 1 – Vault Details
  └─ willType: "one-time" | "editable"
  └─ title, content

Step 2 – Security Questions
  └─ 3–5 pasang question + answer
  └─ Jawaban di-hash SHA-256 oleh klien

Step 3 – Trigger Release
  └─ "manual"  → bisa dibuka kapan saja
  └─ "date"    → dibuka setelah tanggal tertentu
                 (quick: 5/10/15/20 tahun, atau custom)
                 → vault key di-seal dengan Drand time-lock

Step 4 – Review
  └─ Cek semua data sebelum lanjut

Step 5 – Payment (Wander Wallet)
  └─ Enkripsi vault dilakukan di klien
  └─ Dispatch ke Arweave via Wander Wallet (AR token)
  └─ Backend menerima encrypted payload dan menyimpannya

Step 6 – Hasil
  └─ Vault ID (simpan dengan aman)
  └─ 5 Fraction Keys (distribusikan min 3 ke orang berbeda)
  └─ Download backup (Vault ID + Fraction Keys)
```

### 2. Mengklaim Vault (Claim)

```
Step 1 – Masukkan Vault ID
  └─ Sistem fetch security questions dari Arweave

Step 2 – Jawab Security Questions
  └─ Semua pertanyaan harus dijawab dengan benar

Step 3 – Masukkan Fraction Keys (min 3 dari 5)
  └─ Shamir combine untuk rekonstruksi PQC secret key

Step 4 – Buka Vault
  └─ Cek trigger condition (manual / tanggal belum/sudah tercapai)
  └─ Dekripsi vault di sisi klien
  └─ Tampilkan isi vault
```

### 3. Edit Vault (hanya willType: "editable")

```
Step 1 – Masukkan Vault ID

Step 2 – Jawab Security Questions

Step 3 – Masukkan Fraction Keys (min 3 dari 5)
  └─ Backend verifikasi, kirim encrypted vault ke klien

Step 4 – Update Konten (title, content)

Step 5 – Edit Security Questions (opsional)
  └─ Tambah, ubah, atau hapus pertanyaan

Step 6 – Konfirmasi Perubahan

Step 7 – Payment (Wander Wallet)
  └─ Re-enkripsi vault baru di klien
  └─ Dispatch ulang ke Arweave (vault baru disimpan)
  └─ Biaya sama seperti membuat vault baru
```

---

## Setup & Menjalankan

### Prasyarat

- Docker & Docker Compose
- DeepSeek API key (`sk-...`)
- Wander Wallet browser extension (untuk pengguna)

### Langkah Cepat (Production)

```bash
# 1. Clone repo dan masuk direktori
cd bitxen-inheritance

# 2. Buat file environment
cp .env.example .env
# Edit .env: isi DEEPSEEK_API_KEY

# 3. Jalankan
./start.sh prod --detach       # Linux/macOS
.\start.bat prod --detach      # Windows
```

Akses di browser: **http://localhost:7000**

### Manual Docker Compose

```bash
# Production
docker compose --env-file .env up -d

# Development (hot reload)
docker compose -f docker-compose.dev.yml --env-file .env.local up

# Rebuild image
docker compose --env-file .env up --build -d
```

### Port Default

| Service | Port |
|---------|------|
| Nginx (entry point) | 7000 |
| Frontend (Next.js) | 7001 |
| Backend (Express) | 7002 |

---

## Variabel Lingkungan

### File `.env` (root — untuk Docker Compose)

| Variable | Default | Keterangan |
|----------|---------|------------|
| `PROJECT_NAME` | `inheritance` | Nama container Docker |
| `APP_ENV` | `production` | `production` atau `development` |
| `NGINX_PORT` | `7000` | Port akses publik |
| `FRONTEND_PORT` | `7001` | Port internal frontend |
| `BACKEND_PORT` | `7002` | Port internal backend |
| `DEEPSEEK_API_KEY` | _(wajib diisi)_ | API key DeepSeek untuk AI chat |
| `ARWEAVE_GATEWAY` | `https://arweave.net` | Gateway Arweave |
| `BACKEND_BASE_URL` | `http://backend:7002` | URL backend (dari perspektif frontend) |
| `DOCKER_BIND_HOST` | `127.0.0.1` | Bind host Docker (`0.0.0.0` untuk akses eksternal) |
| `NEXT_PUBLIC_MOCK_BLOCKCHAIN` | `false` | `true` untuk simulasi blockchain (dev only) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | — | WalletConnect project ID (opsional) |
| `NEXT_PUBLIC_DEFAULT_CHAIN` | — | Default EVM chain (opsional) |

---

## API Endpoints

### Backend (`/api/v1/vaults`)

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/vaults/estimate-cost` | Estimasi biaya upload vault |
| POST | `/vaults/estimate-cost-simple` | Estimasi biaya dari ukuran data |
| POST | `/vaults/prepare-client` | Simpan vault baru (client-encrypted) |
| POST | `/vaults/:vaultId/prepare-client` | Update vault (edit flow) |
| POST | `/vaults/:vaultId/unlock` | Unlock vault (verifikasi + kirim encrypted vault) |
| POST | `/vaults/:vaultId/security-questions` | Ambil security questions |
| POST | `/vaults/:vaultId/verify-security-questions` | Verifikasi jawaban security questions |

### Backend (`/api/v1/transactions`)

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/transactions/arweave/relay` | Upload ke Arweave via relay |
| POST | `/transactions/arweave/relay/start` | Mulai relay job, return jobId |
| GET | `/transactions/arweave/relay/:jobId/events` | SSE stream progress relay job |
| POST | `/transactions/log` | Log transaksi |
| GET | `/transactions/log` | Ambil semua log transaksi |

### Backend (lainnya)

| Method | Path | Fungsi |
|--------|------|--------|
| POST | `/rag/query` | Query RAG (dokumen vault + dokumentasi) |
| GET | `/ai-quality/metrics` | Metrik kualitas AI |

---

## FAQ

**Apa itu Vault ID?**
Vault ID adalah identifier unik untuk setiap vault. Diperlukan untuk klaim dan edit. Simpan di tempat aman dan informasikan ke ahli waris.

**Apa itu Fraction Keys?**
Kunci enkripsi yang dipecah menjadi 5 bagian menggunakan Shamir's Secret Sharing. Minimal 3 dari 5 fraction key dibutuhkan untuk membuka vault. Distribusikan ke orang-orang berbeda yang dipercaya.

**Apakah data aman jika platform mati?**
Ya. Data disimpan langsung di Arweave blockchain yang terdesentralisasi. Platform hanya sebagai antarmuka; data tetap ada selama blockchain Arweave berjalan.

**Apa bedanya one-time dan editable?**
- `one-time`: Vault permanen, tidak bisa diubah setelah dibuat. Keamanan tertinggi.
- `editable`: Vault bisa diubah, tapi setiap edit memerlukan biaya baru (re-upload ke Arweave).

**Apa yang terjadi jika Vault ID atau Fraction Keys hilang?**
Tanpa Vault ID dan minimal 3 fraction key, vault tidak bisa dibuka. Sistem ini dirancang tanpa recovery — simpan informasi tersebut di tempat aman sejak awal.

**Biaya berapa untuk membuat vault?**
Biaya bervariasi tergantung ukuran data vault dan harga Arweave (AR) saat itu. Sekali bayar, tersimpan selamanya.

**Metode pembayaran apa yang tersedia?**
Saat ini hanya **Wander Wallet** (AR token). Pastikan Wander Wallet browser extension terinstall dan memiliki saldo AR yang cukup.

**Mengapa menggunakan Post-Quantum Cryptography?**
Komputer kuantum berpotensi memecahkan enkripsi standar (RSA, ECDSA) di masa depan. ML-KEM-768 adalah algoritma NIST-approved yang dirancang tahan terhadap serangan kuantum, memastikan vault tetap aman puluhan tahun ke depan.
