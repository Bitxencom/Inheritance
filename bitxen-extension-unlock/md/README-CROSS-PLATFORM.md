# README-CROSS-PLATFORM.md (EncryptionVersion: v2-client)

### 1. Document Purpose
- This document is the cross-platform specification for **Create Vault** and **Unlock Vault** using `encryptionVersion = "v2-client"`.
- It is intended to be the primary reference when implementing the same protocol on **website**, **mobile apps (Android/iOS)**, **desktop apps**, and **browser extensions**.
- Intended audience: senior engineers porting the implementation without changing the security model.
- Primary focus: **business flow**, **encryption flow**, **security model**, and **data structures** that must remain consistent so a vault created on one platform can be unlocked on another.
- This is long-lived documentation: if any scheme/parameter/encoding changes in the codebase, this file must be updated in the same change set.

### 2. Architecture Overview
**Components & boundaries (conceptual, platform-neutral)**
- Client applications (website/mobile/desktop/extension) are responsible for:
  - Payload construction (JSON model), client-side encryption, Shamir split/merge, and client-side decryption.
  - Interacting with a payment flow (when applicable) and/or an on-chain storage wallet.
- Server components are responsible for:
  - Payment orchestration (Stripe) and/or dispatch assistance (depending on product).
  - Fetching encrypted payload from storage, decrypting metadata, and validating security questions.
  - For `v2-client`, servers must not depend on the vault plaintext.

**Deheritance server roles (deployment reality)**
- In the current Deheritance setup, there are two distinct server roles:
  - **Orders service**: payment + post-payment dispatch to data chain.
  - **Vault API service**: read from data chain, return security questions, verify answers, and return `encryptedVault` + `metadata` for client-side decryption.
- A single platform implementation may talk to both roles (often via different base URLs). A self-hosted deployment may merge them into one service, but the API responsibilities must remain the same.

**System flow diagram (v2-client)**
```
User input (title/content/docs/questions)
  -> Client encrypts vault payload (AES) + prepares metadata (answer hashes)
  -> Client (or payments backend) builds "obfuscated payload" {id,v,t,m,d}
  -> Payload is stored in blockchain storage (Data Chain)
  -> On unlock: vaultId + security answers + fraction keys
       -> Backend fetches payload from storage + verifies answers (hash compare)
       -> Backend returns encryptedVault + metadata (without decrypting the payload)
       -> Client combines fraction keys -> derives/decrypts -> renders vault contents
```

**Trust boundaries**
- Public storage boundary: anything on Data Chain/chain is assumed readable by an attacker.
- Client boundary: the only place where vault plaintext exists.
- Backend boundary: should see only encrypted vault payload, but may see:
  - Metadata (after decrypting/deriving metadata key).
  - Security-question answer attempts (user-provided) for verification.

**Portability note (no source code required)**
- This document is written to be shareable and usable without access to this repository.
- It intentionally does not rely on source-file references; everything required to implement and validate interoperability is specified in Sections 3–10 (algorithms, parameters, encodings, data formats, and mandatory flows).

**Deheritance deployment flow (Website + Backend + Vault API)**

Deheritance — v2-client (KEM-wrapped; client-side encryption and client-side unlock)
```text
Vault Creation:
↓
Generate ML-KEM-768 keypair (client)
↓
Encapsulate to self publicKey -> sharedSecret + pqcCipherText (client)
↓
Derive DEK from sharedSecret (first 32 bytes) (client)
↓
Encrypt Vault Payload (AES-GCM) (client)
↓
Split ML-KEM secretKey with Shamir (3-of-5) -> 5 Fraction Keys (client)
↓
Send encryptedVault + metadata to backend (orders service)
  - encryptedVault: { cipherText, iv, checksum, pqcCipherText, alg }
  - metadata.encryptionVersion: "v2-client"
↓
Stripe PaymentIntent / confirmation (client)
↓
Stripe webhook / reconcile (backend)
↓
Dispatch obfuscated payload to Data Chain (backend)

Unlock:
↓
Collect: vaultId + ≥3 Fraction Keys + security answers
↓
Call Deheritance vault API to:
  - load security questions and metadata
  - verify security answers
  - return encryptedVault + metadata (no payload decryption)
↓
Rebuild ML-KEM secretKey via Shamir combine (client)
↓
Decapsulate pqcCipherText (ML-KEM) -> sharedSecret (client)
↓
Derive DEK from sharedSecret (client)
↓
Decrypt vault payload via AES-GCM (client)
```
Important system note:
- `deheritance-backend` currently exposes only `/api/v1/orders` and `/api/v1/stripe/webhook` (payments/dispatch). It does not provide `/api/v1/vaults/*`. The unlock flow therefore depends on a separate “vault API” service to be fully self-sufficient.

### 3. Core Cross-Platform Principles
**Principles that must not change**
- **`encryptionVersion = "v2-client"` means the vault payload is encrypted & decrypted on the client.** The backend must not require vault plaintext.
- **The final decryption key material must be obtainable only from at least 3 Fraction Keys** (Shamir threshold=3, totalShares=5).
- **Data structure formats** (EncryptedVault, ObfuscatedPayload, metadata fields) must be byte-for-byte compatible under the specified encodings (Base64/hex).
- **Security answer normalization** must remain consistent to avoid verification false negatives.

**What may differ**
- UI/UX, framework, programming language.
- Crypto library choices (as long as primitives and parameters are equivalent).
- Storage dispatch mechanism (wallet client-side vs backend dispatch), as long as the on-chain payload structure is identical.

### 4. Global Data Flow
**High-level**
1. User fills vault data (title, content, documents, security questions, trigger).
2. Client builds `vaultPayload` (JSON) and produces secret material (see Section 6).
3. Client encrypts the payload into `encryptedVault`.
4. Client prepares metadata (hashed security answers) and sets `encryptionVersion: "v2-client"`.
5. The system stores an obfuscated payload `{id,v,t,m,d}` to storage.
6. For unlock, the client obtains `encryptedVault` + metadata from a vault API, then decrypts locally using the reconstructed secret from Fraction Keys.
   - Optional UX step: the vault API may expose a “fraction keys sanity-check” call (e.g., format/length checks) before the actual unlock. It must not decrypt the vault payload for `v2-client`.

**Detailed (Deheritance v2-client)**
- Deheritance uses the KEM-wrapped v2-client flow:
  - Secret material split by Shamir is the ML-KEM secretKey (large byte array).
  - `pqcCipherText` is stored in `encryptedVault`.
  - The final AES vaultKey (DEK) is `sharedSecret.slice(0, 32)`.
  - Payload encryption is AES-GCM with a 12-byte IV.

### 5. Encryption & Security Architecture
**Threat model (as implied by the code)**
- An attacker can read all data stored on data chain (public storage).
- An attacker can attempt to brute-force security-question answers based on stored hashes.
- An attacker can steal Fraction Keys from a user device (e.g., localStorage, backup files, screenshots, malware).
- An attacker can publish a modified payload on-chain (more realistically: a newer version; Data Chain is append-only).

**Actual security goals for v2-client**
- Vault payload confidentiality: unlock requires matching secret material reconstructed from **≥ 3 Fraction Keys**.
- Vault payload integrity:
  - For AES-GCM: provided by the AEAD tag (the crypto primitive enforces integrity).
- Zero-knowledge with respect to the backend (payload): the backend sees only ciphertext, not vault plaintext.

**Non-goals (based on the code)**
- Security questions are **not** used to derive encryption keys for the vault payload. They are used as an application-level gate (backend verification) before returning encryptedVault and metadata.

**Algorithms & parameters (used in the codebase)**
- Shamir Secret Sharing (client): `TOTAL_SHARES = 5`, `THRESHOLD = 3`, library `secrets.js-grempe`.
- AES for the vault payload:
  - Deheritance Website: AES-GCM, 12-byte IV.
- PQC KEM (optional, KEM-wrapped variant): ML-KEM-768
  - Scheme: `vaultKey = sharedSecret.slice(0, 32)`; `pqcCipherText` is stored in the vault ciphertext object.
- Hashing security-question answers:
  - Strong format (Deheritance Website): `PBKDF2-HMAC-SHA256`, 210,000 iterations, random 16-byte salt, 32-byte derived output (hex), encoded as `pbkdf2-sha256$${iterations}$${saltBase64}$${hashHex}`.
  - Backend verification must support this format.

**Encrypted data format (vault payload)**
- Frontend ciphertext object (conceptual, wire format):
  - `cipherText`: Base64 ciphertext (for AES-GCM: ciphertext + tag).
  - `iv`: Base64 IV (12 bytes for AES-GCM).
  - `checksum`: hex SHA-256 of ciphertext bytes.
  - `pqcCipherText?`: Base64 ML-KEM ciphertext (optional).
  - `alg`: must be `"AES-GCM"` in Deheritance v2-client.
- Unified decrypt procedure:
  1. Base64-decode IV and cipherText.
  2. If `checksum` exists, compute SHA-256(ciphertext) and compare; if mismatch: fail-fast.
  3. Reject if `alg != "AES-GCM"` or IV length is not 12 bytes.
  4. Derive `vaultKey = MLKEM_Decapsulate(pqcCipherText, keyMaterial).slice(0,32)`.
  5. AES-GCM decrypt -> UTF-8 decode -> JSON.parse.

**Encrypted data format (metadata, on-chain)**
- Obfuscated on-chain payload shape:
  - `{ id, v, t, m, d }`
  - `d` is the encrypted vault payload.
  - `m` is an encrypted metadata string.
- Current metadata format (v3):
  - Prefix: `v3:`
  - Payload bytes: `base64(iv || tag || ciphertext)`
  - Cipher: AES-256-GCM with AAD = `vaultId`
  - Key derivation: PBKDF2(vaultId, "wishlist-ai-security-questions-v1", 100000, 32, SHA-256)
  - Implication: anyone who knows `vaultId` can derive the metadata key; this is obfuscation, not strong confidentiality.

**Error handling policy**
- Client:
  - Prefer generic user-facing errors for decryption/key mismatch.
  - Checksum mismatch can be treated as “corrupted data / tampering suspected”.
- Backend:
  - Wrong security answers: return a generic 401 message.
  - Avoid leaking whether a given vaultId exists beyond what is necessary for UX.

### 6. Key Management & Secret Handling
**Secret material types**
- **Fraction Keys (Shamir shares)**: share strings sufficient to reconstruct the secret (threshold 3). This is the primary secret in the threat model.
- Deheritance v2-client: the secret being split is the **ML-KEM secretKey (large byte array)**, which is used to decapsulate `pqcCipherText` and derive the final AES vaultKey.

**Lifecycle & handling rules**
- Generate secret material only on the client, using a cryptographically secure RNG.
- After encryption:
  - Do not store reconstructed secrets on disk; store only shares as required.
  - Treat local persistence of shares (e.g., browser localStorage) as a security risk and mitigate per platform (see Section 7 notes).
- During unlock:
  - Combine at least 3 shares in memory.
  - Use reconstructed key material only for decryption; then clear buffers best-effort.

**Strict prohibitions (anti-patterns)**
- Sending Fraction Keys to any server for “server-side decryption” in `v2-client`.
- Logging shares, reconstructed secrets, or user answers to analytics/crash reporting.
- Changing normalization rules for security answers without migration support.
- Changing Base64/hex formats or JSON field names without a formal versioned migration.

### 7. Platform Mapping Guide
**Crypto primitives that MUST exist on every target platform**
- CSPRNG: random bytes for keys/IV/salt.
- SHA-256.
- PBKDF2-HMAC-SHA256.
- AES-256-GCM.
- ML-KEM-768 encapsulate/decapsulate (required to unlock vaults that include `pqcCipherText`).
- Shamir Secret Sharing over GF(256), compatible with the `secrets.js-grempe` share string format (hex).
- Encoding: Base64 (standard RFC 4648), hex, UTF-8, JSON.

**Mapping examples**
- Web:
  - AES/PBKDF2/SHA-256: WebCrypto.
  - ML-KEM-768: `@noble/post-quantum/ml-kem`.
  - Shamir: `secrets.js-grempe`.
- Android:
  - AES/PBKDF2/SHA-256: `Cipher`, `SecretKeyFactory` (PBKDF2WithHmacSHA256), or audited libraries.
  - ML-KEM-768: requires a PQC implementation/binding.
  - Shamir: implement GF(256) with compatible shares or use a compatible library.
- iOS:
  - AES-GCM/SHA-256: CryptoKit; PBKDF2 via CommonCrypto as needed.
  - ML-KEM-768: requires a PQC implementation/binding.
  - Shamir: implement GF(256) with compatible shares.

**Platform security notes**
- Mobile/desktop/extension implementations should store Fraction Keys in platform-secure storage:
  - Android: EncryptedSharedPreferences / Keystore-backed storage.
  - iOS: Keychain with appropriate accessibility class.
  - Desktop: OS credential vault where possible.
  - Browser extension: prefer extension storage with encryption, avoid plaintext localStorage.

### 8. Mandatory Flows That Must Not Change
- Create Vault (KEM-wrapped v2-client): ML-KEM keygen -> encapsulate -> derive vaultKey from sharedSecret -> AES-GCM encrypt -> set `pqcCipherText` -> Shamir split ML-KEM secretKey -> upload obfuscated payload -> persist shares.
- Unlock Vault (v2-client): fetch encryptedVault + metadata -> reconstruct keyMaterial from ≥3 shares -> if `pqcCipherText` exists: decapsulate to derive vaultKey -> AES decrypt -> JSON parse.
- Security answer verification: normalization + hash format compatibility must be preserved.
- AES mode selection: must be AES-GCM (reject any other mode).

If any of the flows above changes without a compatible migration, cross-platform implementations must be considered broken.

### 9. New Platform Implementation Checklist
- Base64/hex encode/decode is identical to the web representation.
- Shamir 5-of-3 is compatible with `secrets.js-grempe` share strings.
- AES-256-GCM matches IV size (12 bytes) and default tag behavior (128-bit).
- SHA-256 checksum is computed over ciphertext bytes (not over Base64 text).
- ML-KEM-768 decapsulation produces the same sharedSecret byte sequence as the web implementation.
- PBKDF2:
  - Verifies `pbkdf2-sha256$...` format correctly.
  - Derives metadata key as PBKDF2(vaultId, "wishlist-ai-security-questions-v1", 100000, 32, SHA-256).
- Storage payload parsing:
  - Supports obfuscated `{id,m,d}` payloads.
- No secrets ever reach logs/analytics/crash reports.

### 10. Cross-Platform Pseudocode Examples
**Pseudocode: Create Vault (KEM-wrapped v2-client)**
```
input: vaultPayload (object)

(pk, sk) := mlkem768_keygen()
(pqcCipherText, sharedSecret) := mlkem768_encapsulate(pk)
vaultKey := sharedSecret[0..31]

encryptedVault := aesEncrypt(
  mode="AES-256-GCM",
  key=vaultKey,
  iv=randomBytes(12),
  plaintext=utf8(JSON.stringify(vaultPayload))
)
encryptedVault.pqcCipherText := base64(pqcCipherText)
encryptedVault.alg := "AES-GCM"
encryptedVault.checksum := sha256Hex(ciphertextBytes(encryptedVault))

shares := shamirSplit(secret=sk, total=5, threshold=3)         // sk: large byte array

metadata := {
  trigger: vaultPayload.triggerRelease,
  beneficiaryCount: 0,
  willType: vaultPayload.willDetails.willType,
  securityQuestionHashes: map(vaultPayload.securityQuestions, (q,a) => {
     question: q,
     answerHash: pbkdf2Sha256String(
       normalizedAnswer = NFKC(lowercase(trim(a))),
       salt = randomBytes(16),
       iterations = 210000,
       dkLen = 32
     )
  }),
  encryptionVersion: "v2-client"
}
obfuscatedPayload := { id: vaultId, v: 1, t: "d", m: encryptMetadata(metadata, vaultId), d: encryptedVault }
uploadToStorage(obfuscatedPayload, tags={"Doc-Id": vaultId, ...})

output: vaultId, shares
```

**Pseudocode: Unlock Vault (v2-client, unified)**
```
input: vaultId, shares[>=3], encryptedVault, metadata

keyMaterial := shamirCombine(shares)   // bytes

assert encryptedVault.alg == "AES-GCM"
assert base64Decode(encryptedVault.iv).len == 12

vaultKey := mlkem768_decapsulate(base64Decode(encryptedVault.pqcCipherText), keyMaterial)[0..31]

assert sha256Hex(ciphertextBytes(encryptedVault)) == encryptedVault.checksum   // optional fail-fast

plaintextBytes := aesDecrypt(mode="AES-256-GCM", key=vaultKey, iv=base64Decode(encryptedVault.iv), data=base64Decode(encryptedVault.cipherText))
vaultPayload := JSON.parse(utf8Decode(plaintextBytes))

output: vaultPayload
```
