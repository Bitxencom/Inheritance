# deheritance-extension-unlock — Technical Documentation

Chrome browser extension untuk membuka (unlock) vault Deheritance langsung dari browser, dengan full client-side cryptography.

## Tech Stack

| Kategori | Tech |
|----------|------|
| Framework | React + Vite (Chrome Extension popup) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Crypto — PQC | `@noble/post-quantum` (ML-KEM-768) |
| Crypto — Shamir | `secrets.js-grempe` |
| Crypto — Hashing | `@noble/hashes` |
| Time-Lock | `tlock-js` + `drand-client` |
| Animation | `motion` (Framer Motion) |

## Struktur Folder

```
src/
├── background.ts              # Chrome extension background service worker
├── manifest.json              # Chrome extension manifest (v3)
├── popup/
│   ├── main.tsx               # Entry point popup
│   ├── App.tsx                # Main popup component
│   └── index.css
├── components/
│   └── ui/                    # shadcn/ui components
│       ├── alert.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── glowing-effect.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── multi-step-loader.tsx
│       └── progress.tsx
└── lib/
    ├── arweave.ts             # Arweave fetch & GraphQL helpers
    ├── bitxen.ts              # Bitxen smart contract read helpers (eth_call)
    ├── clientVaultCrypto.ts   # AES-256-GCM, ML-KEM-768, PBKDF2, Drand
    ├── shamirClient.ts        # Shamir split/combine fraction keys
    ├── securityQuestionsClient.ts # PBKDF2 security answer hashing
    ├── types.ts               # TypeScript types
    └── utils.ts               # Utility helpers
```

## Unlock Flow (Extension)

1. User membuka popup extension
2. Input: Vault ID + 3 Fraction Keys
3. `arweave.ts` — cari vault TX di Arweave GraphQL
4. `bitxen.ts` — baca data record dari Bitxen smart contract (eth_call)
5. `shamirClient.ts` — combine 3 fraction keys → PQC secret key
6. `clientVaultCrypto.ts`:
   - `recoverWithDrand()` → recover plainContractSecret (Drand time-lock)
   - `deriveUnlockKey()` → PBKDF2 derive unlock key
   - `unwrapKeyClient()` → unwrap vault key (AES-256-GCM)
   - `decryptVaultPayloadClient()` → decrypt vault content
7. Tampilkan konten vault di popup

## Build & Install

```bash
npm install
npm run build   # output ke dist/
```

Load extension di Chrome:
1. Buka `chrome://extensions/`
2. Enable "Developer mode"
3. Klik "Load unpacked" → pilih folder `dist/`
