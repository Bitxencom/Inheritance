# Vault Bitxen — Dokumentasi Teknis

Dokumentasi teknis lengkap untuk flow **Create Vault** dan **Unlock Vault** pada `bitxen-inheritance` (frontend + backend).

---

## Daftar Isi

1. [Arsitektur Enkripsi](#arsitektur-enkripsi)
2. [Mode Enkripsi](#mode-enkripsi)
3. [Create Vault](#create-vault)
4. [Unlock Vault](#unlock-vault)
5. [Referensi Fungsi](#referensi-fungsi)
6. [Referensi Enkripsi](#referensi-enkripsi)

---

## Arsitektur Enkripsi

Bitxen mendukung **dua mode enkripsi** yang dapat dipilih:

```
Mode A: v1-backend (Backend Encryption)
─────────────────────────────────────────
Vault Content
    │
    ▼
AES-256-CBC (key 32 bytes, random IV 16 bytes) [Node.js backend]
    │
    ├── Classic mode: AES key di-split langsung via Shamir (3-of-5)
    │
    └── PQC hybrid mode:
            ML-KEM-768 encapsulate (backend) → pqcCipherText
            AES key dari sharedSecret
            ML-KEM secretKey di-split via Shamir (3-of-5)

Mode B: v2-client (Client-side Encryption)
─────────────────────────────────────────
Vault Content
    │
    ▼
AES-256-GCM (vaultKey 32 bytes, random IV 12 bytes) [Browser]
    │
    ├── vaultKey ──── AES-256-GCM (sharedSecret) ──→ WrappedKeyV1
    │                       ↑
    │               ML-KEM-768 Encapsulation (client)
    │                       ↑
    │               PQC Secret Key
    │                       │
    │               Shamir Secret Sharing (3-of-5)
    │                       │
    │               5x Fraction Keys (user holds)
    │
    └── plainContractSecret ──→ Drand Time-Lock ──→ sealedContractSecret
```

### Layers Keamanan

| Layer | Mode | Mekanisme | Keterangan |
|-------|------|-----------|------------|
| L1 | v1-backend | AES-256-CBC | Enkripsi payload vault (backend Node.js) |
| L1 | v2-client | AES-256-GCM | Enkripsi payload vault (browser WebCrypto) |
| L2 | keduanya (opsional) | ML-KEM-768 (Kyber) | Post-Quantum key encapsulation |
| L3 | keduanya | Shamir Secret Sharing (3-of-5) | Split key material |
| L4 | v2-client | Drand Time-Lock | Kunci waktu terdesentralisasi |
| L5 | v2-client | PBKDF2-SHA256 | Unlock key derivation |
| L6 | v2-client | keccak256 | Anti-bypass commitment hash |
| L7 | keduanya | AES-256-GCM + PBKDF2 | Enkripsi metadata (vaultId-based) |

---

## Mode Enkripsi

| Aspek | `v1-backend` | `v2-client` |
|-------|-------------|-------------|
| Enkripsi dilakukan di | Backend (Node.js) | Browser (WebCrypto) |
| AES mode | AES-256-CBC (IV 16 bytes) | AES-256-GCM (IV 12 bytes) |
| PQC (opsional) | `encryptPayloadHybrid()` di backend | `encapsulatePqcClient()` di browser |
| Storage dispatch | Frontend via Wander Wallet (Arweave) | Frontend via Wander Wallet (Arweave) |
| Security question hash | PBKDF2-SHA256 (210k iter, random salt) | PBKDF2-SHA256 (210k iter, random salt) |
| `encryptionVersion` di metadata | `"v1-backend"` | `"v2-client"` |

> **Catatan:** `hashSecurityAnswerClient()` di Bitxen menggunakan PBKDF2-SHA256 (210k iterations, random salt, NFKC normalization) — sama dengan Deheritance Website. Vault lama yang dibuat sebelum upgrade (SHA-256 sederhana) tetap bisa di-unlock karena `verifySecurityAnswerHash()` di backend mendeteksi format hash secara otomatis.

---

## Create Vault

### Mode A: v1-backend (Backend Encryption)

**File Utama:**
- `frontend/components/assistant-ui/tools/vault-creation-wizard/` — UI wizard
- `backend/src/services/vault-service.ts` — fungsi `prepareVault()`
- `backend/src/services/crypto/aes.ts` — AES encrypt/decrypt
- `backend/src/services/crypto/pqc.ts` — ML-KEM-768
- `backend/src/services/crypto/shamir.ts` — Shamir split/combine
- `backend/src/routes/rag.ts` — API endpoint vault prepare

**Flow Step-by-Step (Backend):**

```
Step 1: Frontend kirim VaultPayload ke backend
    │ POST /api/v1/vaults/prepare-client (atau endpoint vault preparation)
    │ Payload: { title, content, beneficiaries, securityQuestions, triggerRelease,
    │            willType, storageType, enablePqc }
    │
Step 2: Backend generate vaultId
    │ randomVaultId() → UUID
    │
Step 3a: Classic Mode (enablePqc = false)
    │ generateAesKey() → key (32 bytes random, Node.js crypto.randomBytes)
    │ encryptPayload(vaultPayload, key)
    │ → AES-256-CBC (IV 16 bytes random)
    │ → Output: { cipherText (base64), iv (base64), checksum (SHA-256 hex) }
    │ splitKey(key, { totalShares: 5, threshold: 3 })
    │ → secrets.share(hexKey, 5, 3) via secrets.js-grempe
    │ → Output: fractionKeys[5]
    │
Step 3b: PQC Hybrid Mode (enablePqc = true)
    │ generatePqcKeyPair()
    │ → ml_kem768.keygen() → { publicKey, secretKey }
    │ encryptPayloadHybrid(vaultPayload, pqcKeyPair.publicKey)
    │ → encapsulate(publicKey) → { pqcCipherText, sharedSecret }
    │ → vaultKey = sharedSecret.slice(0, 32)
    │ → AES-256-GCM(payload, vaultKey)
    │ → Output: { cipherText, iv, checksum, pqcCipherText, isPqcEnabled: true }
    │ splitKey(pqcSecretKey, { totalShares: 5, threshold: 3 })
    │ → Output: fractionKeys[5] (dari PQC secretKey, bukan AES key)
    │
Step 4: Hash Security Questions
    │ hashSecurityAnswer(answer)  [async]
    │ → normalize: NFKC + lowercase + trim
    │ → PBKDF2-SHA256 (210k iterations, random 16-byte salt)
    │ → Output: "pbkdf2-sha256$210000$<saltBase64>$<hashHex>"
    │
    │ encryptQuestion(question, vaultId)
    │ → AES-256-CBC(question, deriveKeyFromVaultId(vaultId))
    │ → Stored as obfuscated: { q: encryptedQuestion, a: answerHash }
    │
Step 5: Fraction Key Commitments
    │ buildFractionKeyCommitmentsV1(fractionKeys)
    │ → sha256HexFromString(key) per share
    │ → Output: { scheme: "sha256", version: 1, byShareId: { "1": hash, ... } }
    │
Step 6: Metadata Assembly & Encryption
    │ metadata = {
    │   trigger: triggerRelease,
    │   beneficiaryCount: beneficiaries.length,
    │   securityQuestionHashes: [{ q, a }],
    │   fractionKeyCommitments,
    │   willType,
    │   isPqcEnabled: true|false,
    │   encryptionVersion: "v1-backend",
    │   pqcPublicKey? (jika PQC)
    │ }
    │ encryptMetadata(metadata, vaultId)
    │ → PBKDF2-SHA256(vaultId, "wishlist-ai-security-questions-v1", 100000 iter)
    │ → AES-256-GCM encrypt (AAD = vaultId bytes)
    │ → Output: "v3:<base64(iv[12] || authTag[16] || ciphertext)>"
    │
Step 7: Arweave Payload Assembly
    │ arweavePayload = {
    │   id: vaultId,
    │   v: 1,
    │   t: "d",
    │   m: <encrypted metadata>,
    │   d: <EncryptedVault>
    │ }
    │
Step 8: Return ke Frontend
    │ Response: {
    │   vaultId,
    │   fractionKeys[5],
    │   arweavePayload,
    │   encryptedVault,
    │   pqcKeyPair? (base64 serialized, jika PQC)
    │ }
    │
Step 9: Frontend Dispatch via Wander Wallet
    │ useArweaveUpload() hook
    │ → upload arweavePayload ke Arweave via Wander wallet (client-side sign)
    │ → tags: { "App-Name": "doc-storage", "Type": "doc", "Doc-Id": vaultId }
    │ → Arweave TX confirm → arweaveTxId
    │
    │ (Jika storageType = "bitxenArweave"):
    │ → Upload bitxen-index document ke Arweave
    │   { schema: "bitxen-index", vaultId,
    │     bitxen: { chainId, chainKey, contractAddress, contractDataId },
    │     arweave: { contentTxId } }
    │ → Register ke Bitxen smart contract on-chain
    │
Step 10: Local Storage
    │ savePendingVault(vault)
    │ → localStorage key: "wishlist_pending_vaults"
    │ → Menyimpan: vaultId, title, fractionKeys, arweaveTxId,
    │   blockchainTxHash, blockchainChain, contractDataId, contractAddress
```

---

### Mode B: v2-client (Frontend Encryption)

**File Utama:**
- `frontend/lib/clientVaultCrypto.ts` — semua fungsi crypto client-side
- `frontend/lib/shamirClient.ts` — Shamir split/combine
- `frontend/lib/securityQuestionsClient.ts` — hash security answers
- `frontend/lib/drand.ts` — Drand ronde calculation
- `frontend/lib/vault-storage.ts` — localStorage management
- `frontend/hooks/use-arweave-upload.ts` — Wander wallet upload hook

**Flow Step-by-Step (Frontend):**

```
Step 1: User mengisi form vault (wizard)
    │ title, content, dokumen, triggerType/Date,
    │ security questions & answers, storageType
    │
Step 2: Key Generation (semua di browser)
    │ generateVaultKey()           → vaultKey (32 bytes random)
    │ generatePqcKeyPairClient()   → { publicKey, secretKey } ML-KEM-768
    │ generateRandomSecret()       → plainContractSecret ("0x" + 32 bytes hex)
    │
Step 3: PQC Encapsulation
    │ encapsulatePqcClient(pqcPublicKey)
    │ → ML-KEM-768 encapsulate
    │ → Output: { pqcCipherText (base64), sharedSecret (32 bytes) }
    │
Step 4: Enkripsi Konten Vault
    │ encryptVaultPayloadClient(payload, vaultKey)
    │ → AES-256-GCM (IV 12 bytes random)
    │ → Output: { cipherText, iv, checksum (SHA-256), alg: "AES-GCM" }
    │
Step 5: Wrapping Vault Key
    │ wrapKeyClient(vaultKey, sharedSecret)
    │ → encryptBytesClient(vaultKey, sharedSecret) via AES-256-GCM
    │ → Output: WrappedKeyV1 {
    │     schema: "bitxen-wrapped-key-v1", v: 1, alg: "AES-GCM",
    │     iv, checksum, cipherText
    │   }
    │
Step 6: Time-Lock Encryption (Drand)
    │ timestampToDrandRonde(releaseTimestamp) → triggerRonde (number)
    │ sealWithDrand(plainContractSecret, triggerRonde)
    │ → tlock-js timelockEncrypt via Drand Quicknet
    │ → Output: sealedContractSecret (string)
    │
Step 7: Shamir Secret Sharing (Fraction Keys)
    │ splitKeyClient(pqcSecretKey)
    │ → secrets.share(hexKey, 5, 3) via secrets.js-grempe
    │ → Output: fractionKeys[5]
    │
Step 8: Hash Security Questions
    │ hashSecurityAnswerClient(answer)
    │ → normalize: NFKC + lowercase + trim
    │ → PBKDF2-SHA256 (210k iterations, random 16-byte salt)
    │ → Output: "pbkdf2-sha256$210000$<saltBase64>$<hashHex>"
    │
Step 9: Fraction Key Commitments
    │ buildFractionKeyCommitmentsV1(fractionKeys)
    │ → sha256HexFromString(key) per share
    │ → Output: { scheme: "sha256", version: 1, byShareId: {...} }
    │
Step 10: Commitment Hash
    │ calculateCommitment({ dataHash, wrappedKeyHash, ownerAddress })
    │ → keccak256(dataHash || wrappedKeyHash || ownerAddress)
    │ → Output: 0x prefixed hex
    │
Step 11: Metadata Encryption
    │ encryptMetadataClient(metadata, vaultId)
    │ → PBKDF2-SHA256(vaultId, "wishlist-ai-security-questions-v1", 100000 iter)
    │ → AES-256-GCM (AAD = vaultId bytes)
    │ → Output: "v3:<base64(iv[12] || authTag[16] || ciphertext)>"
    │
Step 12: Arweave Payload
    │ prepareArweavePayloadClient({ vaultId, encryptedVault, metadata })
    │ → Output: { id, v: 1, t: "d", m, d }
    │
Step 13: Upload via Wander Wallet
    │ useArweaveUpload() → arUpload(arweavePayload, vaultId, storageType)
    │ → Arweave TX → arweaveTxId
    │ → (Jika storageType = "bitxenArweave"):
    │   upload bitxen-index + register ke smart contract
    │
Step 14: Local Storage
    │ savePendingVault(vault)
    │ → localStorage key: "wishlist_pending_vaults"
```

---

## Unlock Vault

**File Utama:**
- `frontend/components/assistant-ui/tools/vault-claim-wizard/hooks/use-vault-claim.ts` — UI & orchestration
- `frontend/lib/bitxen-discovery.ts` — discover vault dari Arweave + blockchain
- `frontend/lib/clientVaultCrypto.ts` — fungsi decrypt
- `frontend/lib/shamirClient.ts` — `combineSharesClient()`
- `frontend/lib/metamaskWallet.ts` — `readBitxenDataRecord()`, `finalizeRelease()`

### Flow Step-by-Step

```
Step 1: Enter Vault ID
    │ User memasukkan Inheritance ID (vaultId)
    │
    │ POST /api/vault/claim/verify
    │ → Load security questions dari Arweave metadata
    │ → Decrypt metadata dari payload Arweave
    │ → Response: { securityQuestions, triggerRelease, willType, latestTxId }
    │
Step 2: Security Questions
    │ User menjawab security questions
    │
    │ POST /api/vault/verify-security-questions
    │ → Backend verifikasi via verifySecurityAnswerHash():
    │   PBKDF2 path jika hash starts with "pbkdf2-sha256$" (vault baru)
    │   SHA-256 legacy path jika plain hex (vault lama — backward compat)
    │ → Response: { success, validIndexes }
    │
Step 3: Fraction Keys (3 dari 5)
    │ User memasukkan 3 fraction keys
    │
    │ verifyFractionKeyCommitmentsIfPresent({ metadata, fractionKeys })
    │ → Cek commitmentConfig.scheme === "sha256" && version === 1
    │ → parseFractionKeyShareInfo(key) → { bits, id }
    │ → sha256Hex(key) === commitments.byShareId[shareId]
    │
    │ POST /api/vault/verify-fraction-keys (opsional backend check)
    │
Step 4: Discover & Download Vault
    │ tryLoadHybridEncryptedVault({ vaultId, onProgress }) [bitxen-discovery.ts]
    │
    │ 4a. Find latest Arweave TX:
    │     findLatestArweaveDocTxIdForVault(vaultId)
    │     GraphQL tag App-Name="doc-storage", Type="doc", Doc-Id=vaultId
    │
    │ 4b. Download & hash payload:
    │     fetchArweaveText(txId) → raw text
    │     sha256Hex(vaultBytes) → latestHash
    │
    │ 4c. Discover on blockchain (3 strategi):
    │     Priority 1: Local cache
    │       getVaultById(vaultId) → localVault
    │       readBitxenDataRecord({ chainId, contractDataId }) via eth_call
    │       Verifikasi: record.currentDataHash === latestHash
    │
    │     Priority 2: Arweave bitxen-index document
    │       GraphQL tag Type="bitxen-index", Doc-Id=vaultId
    │       Fetch & parse: { bitxen: { chainId, chainKey, contractAddress, contractDataId } }
    │
    │     Priority 3: Hash scanning (brute force lintas chains + versi)
    │       getAvailableChains() → semua ChainId
    │       readBitxenDataIdByHash({ chainId, dataHash, version 1..5 }) → contractDataId
    │       readBitxenDataRecord() → verifikasi hash
    │
    │ 4d. Validasi waktu & status:
    │     releaseDate, isReleased, releaseEntropy
    │     Jika belum saatnya → throw error
    │
    │ 4e. Integrity check:
    │     sha256(payload) === record.currentDataHash
    │
    │ 4f. Decrypt metadata:
    │     decryptMetadataClient(payloadJson.m, vaultId)
    │     → Extract: contractEncryptedKey (WrappedKeyV1), sealedContractSecret
    │
    │ 4g. Extract encrypted key:
    │     extractWrappedKeyRawFromMetadata(metadata)
    │     → Cek: metadata.contractEncryptedKey | metadata.encryptedKey |
    │       metadata.wrappedKey | metadata.envelope.encryptedKey
    │
Step 5: Reconstruct Key (Shamir Combine)
    │ combineSharesClient(fractionKeys[3 buah])
    │ → secrets.combine(shares) via Lagrange interpolation di GF(2^8)
    │ → Output: keyMaterial (Uint8Array)
    │
    │ Mode bergantung pada encryptionVersion di metadata:
    │   - v1-backend classic: keyMaterial adalah AES key langsung
    │   - v1-backend PQC / v2-client: keyMaterial adalah ML-KEM secretKey
    │
Step 6: Derive AES Key
    │ Path A — Hybrid (WrappedKeyV1 ada di metadata):
    │   deriveUnlockKey(keyMaterial, releaseEntropy, { contractAddress, chainId })
    │   → saltRaw = "${releaseEntropy}:${chainId}:${contractAddress}"
    │   → PBKDF2-SHA256(keyMaterial, saltRaw, 100000 iterations) → unlockKey
    │   parseWrappedKeyV1(contractEncryptedKey) → WrappedKeyV1
    │   unwrapKeyClient(wrappedKeyV1, unlockKey) → vaultKey
    │
    │ Path B — PQC (pqcCipherText ada di encryptedVault):
    │   deriveEffectiveAesKeyClient(encryptedVault, keyMaterial)
    │   → ml_kem768.decapsulate(pqcCipherText, keyMaterial).slice(0, 32) → vaultKey
    │
    │ Path C — Classic v1-backend (keyMaterial = AES key langsung):
    │   decryptVaultPayloadRawKeyClient(encryptedVault, keyMaterial)
    │   → AES-256-CBC atau AES-256-GCM (infer dari IV length)
    │
Step 7: (Opsional) Recover Time-Lock Secret (Drand)
    │ recoverWithDrand(sealedContractSecret)
    │ → tlock-js timelockDecrypt via Drand Quicknet
    │ → Output: plainContractSecret (Uint8Array)
    │
Step 8: Decrypt Vault Content
    │ decryptVaultPayloadClient(encryptedVault, vaultKey)
    │ → Verifikasi checksum: SHA-256(ciphertext) === checksum
    │ → Jika pqcCipherText: ml_kem768.decapsulate → derive key
    │ → AES-GCM atau AES-CBC (infer dari alg field atau IV length)
    │ → JSON.parse → plaintext vault
    │ → Output: { title, content, documents, ... }
    │
Step 9: (Opsional) On-chain Finalization
    │ finalizeRelease({ chainId, contractDataId, contractAddress })
    │ → MetaMask: eth_requestAccounts → wallet_switchEthereumChain
    │ → eth_sendTransaction: finalizeRelease(bytes32)
    │ waitForTransaction({ txHash, chainId })
    │ → Poll eth_getTransactionReceipt setiap 2.5 detik
    │
Step 10: Tampilkan Konten
    │ vaultTitle, vaultContent, unlockedDocuments
    │ Dokumen (attachment) bisa di-download
```

---

## Referensi Fungsi

### `frontend/lib/clientVaultCrypto.ts`

| Fungsi | Deskripsi |
|--------|-----------|
| `generateVaultKey()` | Generate 32-byte random AES key via `crypto.getRandomValues` |
| `generateRandomSecret()` | Generate 32-byte hex secret dengan prefix "0x" |
| `generatePqcKeyPairClient()` | Generate ML-KEM-768 keypair (publicKey, secretKey) |
| `encapsulatePqcClient(publicKey)` | ML-KEM-768 encapsulate → pqcCipherText + sharedSecret |
| `encryptVaultPayloadClient(payload, key)` | AES-256-GCM encrypt JSON payload |
| `decryptVaultPayloadClient(encrypted, key)` | AES-256-GCM/CBC decrypt → JSON (dengan PQC path) |
| `decryptVaultPayloadRawKeyClient(encrypted, key)` | Decrypt tanpa PQC decapsulation (raw key langsung) |
| `deriveEffectiveAesKeyClient(encrypted, keyMaterial)` | Derive AES key: PQC decapsulate atau passthrough |
| `encryptBytesClient(plain, key)` | AES-256-GCM encrypt raw bytes |
| `decryptBytesClient(encrypted, key)` | AES-256-GCM/CBC decrypt raw bytes (infer dari IV length) |
| `wrapKeyClient(keyToWrap, wrappingKey)` | Wrap key → WrappedKeyV1 via AES-256-GCM |
| `unwrapKeyClient(wrapped, wrappingKey)` | Unwrap WrappedKeyV1 → raw key bytes |
| `sealWithDrand(payload, ronde)` | Drand time-lock encrypt via tlock-js |
| `recoverWithDrand(sealedRecord)` | Drand time-lock decrypt |
| `deriveUnlockKey(shareKey, releaseEntropy, context)` | PBKDF2-SHA256 key derivation (100k iter) |
| `calculateCommitment({ dataHash, wrappedKeyHash, ownerAddress })` | keccak256 anti-bypass commitment |
| `encryptMetadataClient(metadata, vaultId)` | Enkripsi metadata → format "v3:..." |
| `decryptMetadataClient(encryptedStr, vaultId)` | Dekripsi metadata format "v3:..." |
| `prepareArweavePayloadClient({ vaultId, encryptedVault, metadata })` | Assemble Arweave payload { id,v,t,m,d } |

### `frontend/lib/shamirClient.ts`

| Fungsi | Deskripsi |
|--------|-----------|
| `splitKeyClient(key)` | Split Uint8Array key → 5 fraction keys (3-of-5 threshold) |
| `combineSharesClient(shares)` | Combine ≥3 shares → original key (Uint8Array) via Lagrange |

> **Perbedaan dengan deheritance-website:** Tidak ada `normalizeFractionKeysClient()` atau `combineFractionKeysClient()` — hanya `splitKeyClient` + `combineSharesClient`.

### `frontend/lib/securityQuestionsClient.ts`

| Fungsi | Deskripsi |
|--------|-----------|
| `hashSecurityAnswerClient(answer)` | PBKDF2-SHA256 (210k iter, random salt, NFKC norm) → `"pbkdf2-sha256$..."` |

### `frontend/lib/bitxen-discovery.ts`

| Fungsi | Deskripsi |
|--------|-----------|
| `tryLoadHybridEncryptedVault({ vaultId, onProgress })` | Main discovery: 3-strategi Arweave + blockchain lookup |
| `discoverBitxenChainInfo({ vaultId, arweaveTxId, chainKeyHint })` | Lightweight discovery: hanya cari contractDataId + chainKey |
| `discoverBitxenEncryptedKeyForVault(vaultId)` | Find chainKey + contractDataId (hash scan sampai version 30) |
| `findLatestArweaveDocTxIdForVault(vaultId)` | Query Arweave GraphQL → latest TX ID |
| `fetchArweaveText(txId)` | Fetch raw text dari `https://arweave.net/{txId}` |
| `parseArweaveTxIdFromStorageURI(storageURI)` | Parse `ar://` URI → raw TX ID |
| `extractWrappedKeyRawFromMetadata(metadata)` | Extract encrypted key dari berbagai field metadata |
| `parseWrappedKeyV1(value)` | Validasi & cast ke WrappedKeyV1 |
| `verifyFractionKeyCommitmentsIfPresent({ metadata, fractionKeys })` | Verifikasi sha256 commitments dari metadata |

### `backend/src/services/vault-service.ts`

| Fungsi | Deskripsi |
|--------|-----------|
| `prepareVault(payload)` | Main backend vault preparation (v1-backend) |
| `encryptMetadata(metadata, vaultId)` | AES-256-GCM encrypt metadata → "v3:..." (Node.js) |
| `decryptMetadata(encryptedData, vaultId)` | Decrypt metadata: v3 (GCM), legacy CBC |
| `hashSecurityQuestionAnswers(questions, vaultId)` | Hash answers + encrypt questions → `[{ q, a }]` |
| `encryptQuestion(question, vaultId)` | AES-256-CBC encrypt question text |
| `decryptQuestion(encryptedData, vaultId)` | AES-256-CBC decrypt question text |
| `buildFractionKeyCommitmentsV1(fractionKeys)` | Build sha256 commitments untuk tiap share |
| `deriveKeyFromVaultId(vaultId)` | PBKDF2(vaultId, fixed-salt, 100000 iter) → Buffer 32 bytes |

### `backend/src/services/crypto/aes.ts`

| Fungsi | Deskripsi |
|--------|-----------|
| `generateAesKey()` | Generate 32-byte random AES key (Node.js crypto) |
| `encryptPayload(payload, key)` | AES-256-CBC encrypt JSON → `{ cipherText, iv, checksum }` |
| `decryptPayload(encrypted, key)` | AES-256-CBC decrypt → JSON |
| `encryptPayloadHybrid(payload, pqcPublicKey)` | AES-256-GCM + ML-KEM-768 hybrid encrypt |

### `backend/src/services/crypto/shamir.ts`

| Fungsi | Deskripsi |
|--------|-----------|
| `splitKey(key, { totalShares, threshold })` | Split Buffer → string[] shares via secrets.js-grempe |
| `combineShares(shares)` | Combine shares → Buffer |

### `backend/src/services/crypto/pqc.ts`

| Fungsi | Deskripsi |
|--------|-----------|
| `generatePqcKeyPair()` | Generate ML-KEM-768 keypair di Node.js |
| `encapsulate(publicKey)` | ML-KEM-768 encapsulate → `{ pqcCipherText, sharedSecret }` |
| `decapsulate(cipherText, secretKey)` | ML-KEM-768 decapsulate → sharedSecret |
| `serializeKeyPair(keyPair)` | Serialize keypair ke base64 string |

### `frontend/lib/vault-storage.ts`

| Fungsi | Deskripsi |
|--------|-----------|
| `savePendingVault(vault)` | Simpan vault ke localStorage |
| `getPendingVaults()` | Get semua pending vaults (handle legacy shardKeys/shards format) |
| `getVaultById(vaultId)` | Get single vault by ID |
| `isIncompleteHybridVault(vault)` | Cek apakah vault hybrid belum selesai di-finalize |

---

## Referensi Enkripsi

### Algoritma yang Digunakan

| Algoritma | Library | Kegunaan |
|-----------|---------|----------|
| **AES-256-CBC** | Node.js `crypto` (backend) | Enkripsi payload v1-backend classic, enkripsi pertanyaan |
| **AES-256-GCM** | Web Crypto API (frontend) / Node.js `crypto` (backend) | Enkripsi payload v2-client, wrapping key, metadata |
| **ML-KEM-768 (Kyber)** | `@noble/post-quantum/ml-kem` (frontend + backend) | Post-Quantum key encapsulation |
| **Shamir Secret Sharing** | `secrets.js-grempe` | Split/combine key material di GF(2^8) |
| **SHA-256** | Web Crypto API / Node.js `crypto` | Checksum integrity vault payload |
| **PBKDF2-SHA256** | Web Crypto API / Node.js `pbkdf2Sync` | Metadata key derivation, unlock key derivation |
| **keccak-256** | `@noble/hashes/sha3` | Anti-bypass commitment hash |
| **Drand Time-Lock** | `tlock-js` + `drand-client` | Time-gated encryption via Drand Quicknet |

### Drand Quicknet Config

```
URL:          https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971
Chain Hash:   52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971
Genesis Time: 1692803367000 (ms)
Period:       3000ms (3 detik per ronde)
```

### PBKDF2 Parameters

| Penggunaan | Salt | Iterations | Hash | Where |
|------------|------|-----------|------|-------|
| Metadata key derivation | `"wishlist-ai-security-questions-v1"` | 100,000 | SHA-256 | Frontend + Backend |
| Unlock key derivation | `"${releaseEntropy}:${chainId}:${contractAddress}"` | 100,000 | SHA-256 | Frontend |

### Format Metadata Terenkripsi

```
Format: "v3:<base64(iv[12] || authTag[16] || ciphertext)>"
AAD:    vaultId bytes (Authenticated Additional Data)
Key:    PBKDF2-SHA256(vaultId, salt="wishlist-ai-security-questions-v1", 100000 iter)
```

### Shamir Secret Sharing Config

```
Total Shares:  5  (dari appEnv.shamirTotalShares)
Threshold:     3  (dari appEnv.shamirThreshold)
Field:         GF(2^8) — Galois Field
Library:       secrets.js-grempe
```

### Bitxen-Index Document (Arweave)

Dokumen tambahan yang di-upload ke Arweave untuk mempercepat discovery (tidak perlu scan semua chains):

```json
{
  "schema": "bitxen-index",
  "vaultId": "<uuid>",
  "storageType": "bitxenArweave",
  "bitxen": {
    "chainId": 12345,
    "chainKey": "bitxen-mainnet",
    "contractAddress": "0x...",
    "contractDataId": "0x..."
  },
  "arweave": {
    "contentTxId": "<arweaveTxId>"
  }
}
```

Tags Arweave untuk bitxen-index: `App-Name="doc-storage"`, `Type="bitxen-index"`, `Doc-Id=<vaultId>`

### Security Answer Hashing (Bitxen vs Deheritance)

| Produk | Algoritma | Format Output |
|--------|-----------|---------------|
| **Bitxen** (baru) | PBKDF2-SHA256 (210k iter, random salt, NFKC) | `"pbkdf2-sha256$210000$<saltBase64>$<hashHex>"` |
| **Deheritance Website** | PBKDF2-SHA256 (210k iter, random salt, NFKC) | `"pbkdf2-sha256$210000$<saltBase64>$<hashHex>"` |
| **Bitxen** (legacy, vault lama) | SHA-256(`lowercase(trim(answer))`) | hex string 64 chars |

`verifySecurityAnswerHash()` di backend otomatis deteksi format — vault lama tetap bisa di-unlock.
