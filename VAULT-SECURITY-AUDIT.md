# Vault Security Audit: Bitxen Inheritance (Updated Feb 2026)

## 1. Overview
This document tracks the security posture of the Bitxen Inheritance (deheritance) project. The system has transitioned to a **Hybrid Post-Quantum Cryptography (PQC)** and **Drand Time-Lock** architecture.

**Current Audit Status:** 🟡 CAUTION (IMPROVEMENTS NEEDED)
**Primary Storage:** Arweave (via Wander Wallet)
**Registry/Status Gatekeeper:** `Bitxen.sol` (BSC/Polygon/etc)

---

## 2. Remediated Vulnerabilities (Previously Critical)

### 2.1 [FIXED] The "Public Secret" Leak
*   **Previous Issue:** Plaintext secrets were sent in transaction calldata to the blockchain.
*   **Remediation:** 
    *   The system now sends `0x0...0` as the `params.secret` to the Bitxen contract.
    *   **Drand Integration:** The real decryption secret is now sealed using **Drand Time-Lock** (`tlock-js`) and included in Arweave metadata.
    *   **Commitment Anchor:** A cryptographic commitment (`keccak256(dataHash + wrappedKeyHash + owner)`) is stored on-chain to ensure integrity and prevent substitution attacks without exposing the secret.

---

## 3. Active Vulnerabilities (MEDIUM RISK)

### 3.1 Metadata Privacy: Public Key Derivation (MEDIUM)
*   **Issue:** Metadata encryption (hiding Shamir configurations and security questions) uses a key derived from the `vaultId`.
*   **Vulnerability:** The `vaultId` is used as a public identifier on Arweave. An observer can re-derive the encryption key using the static salt (`"wishlist-ai-security-questions-v1"`) and decrypt the metadata.
*   **Impact:** Leakage of `triggerRonde`, `fractionKeyCommitments`, and security question text.

### 3.2 Local Storage Exposure (MEDIUM)
*   **Issue:** The system saves `fractionKeys` (Shamir Secret Sharing shards) in `localStorage` in plaintext.
*   **Vulnerability:** Any malicious script or user with physical access to the browser can extract the shards.
*   **Impact:** If combined with the metadata leak (3.1), an attacker could theoretically recover the vault contents if the trigger condition is met (or if the vault is an "Editable" type with manual release enabled).

### 3.3 Client-Side Signature Normalization (BUG/UX)
*   **Issue:** Intermittent "verify() returned false" errors during Arweave upload.
*   **Root Cause:** Improper Base64URL normalization of the transaction `id`, `owner`, and `signature` after Wander Wallet signing.
*   **Severity:** Low (Denial of Service for vault creation), but affects reliability.

---

## 4. Security Gatekeepers in Bitxen.sol

The following mechanisms are correctly maintained:
1.  **Status Gatekeeper:** The contract strictly enforces `releaseDate` before allowing access to the registered entry status.
2.  **Commitment Verification:** The `finalizeRelease` logic (intended) compares the provided secret hash against the stored `commitment`.
3.  **Ownership Integrity:** Only the `msg.sender` who created the vault can update/delete it on-chain.

---

## 5. Remediation Roadmap

1.  **Harden Metadata Salt:** 
    *   *Action:* Include the owner's signature or a secret derived from the wallet in the metadata key derivation process.
    *   *Goal:* Ensure only the owner (or eventually the beneficiary) can decrypt the metadata.

2.  **Secure Local Storage:**
    *   *Action:* Encrypt `localStorage` data using a session-based key or prompts for a "Primary PIN". 
    *   *Alternative:* Prompt the user to clear browser cache after confirming manual backup download.

3.  **Signature Hardening:**
    *   *Action:* Implement strict `Base64URL` normalization using regex in `wanderWallet.ts` before calling `arweave.transactions.verify()`.

---

## 6. Conclusion
The transition to **Drand + PQC** has successfully eliminated the most critical flaw (plaintext blockchain secrets). The remaining vulnerabilities are primarily related to **Metadata Privacy** and **Local Data Persistance**, which can be addressed through further frontend refinements without requiring contract redeployment.
