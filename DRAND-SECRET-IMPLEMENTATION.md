# DRAND Time-Lock & Secret-Binding Implementation

## Overview
To prevent "calldata exposure" of secrets on the blockchain, we will implement a Drand-based Time-Lock mechanism. The secret is no longer sent effectively as plaintext to the contract. Instead, the contract's generated `releaseEntropy` and a Drand beacon for the release date will be the mandatory components for decryption.

## System Flowcharts

### 1. Creation Flow
```text
[ User Content + Release Date ]
      |
      v
[ Generate plainSecret locally ] ----------> [ localStorage & Backup File ]
      |
      v (Drand: tlock.seal)
[ sealedSecret ]
      |
      +------> [ Upload to Arweave Metadata ]
      |
      +------> [ Register on Bitxen (secret = 0x0) ]
```

### 2. Edit Flow (Owner Only)
```text
[ Owner Login + Vault ID ]
      |
      v
{ Local Secret Found? } ---- No ----> [ User Uploads Backup File ]
      |                                      |
     Yes <-----------------------------------+
      |
      v
[ Unlock Vault for Editing ]
      |
      v
[ Modify Content / Release Date ]
      |
      v
{ Release Date Changed? } ---- No ----> [ Use Existing sealedSecret ]
      |                                           |
     Yes                                          |
      |                                           |
      v (Drand: Re-Seal with New Ronde)           |
[ New sealedSecret ] <----------------------------+
      |
      v
[ Update Arweave Metadata & Bitxen Record ]
```

### 3. Claim Flow (Beneficiary)
```text
[ Beneficiary Enter Vault ID ]
      |
      v
[ Fetch sealedSecret from Arweave ]
      |
      v
[ Fetch releaseEntropy from Bitxen Smart Contract ]
      |
      v
{ Is Release Time Reached? } --- No ---> [ FAIL: Wait for Drand Beacon ]
      |
     Yes
      |
      v (Drand: tlock.recover)
[ Fetch Drand Beacon Signature ]
      |
      v
[ Recover plainSecret from sealedSecret ]
      |
      v
[ Combine with releaseEntropy ]
      |
      v
[ Decrypt Vault Content ]
```

## Core Strategy: The "Double-Lock"
The vault unlock key will be derived using:
1. **User Shares (Shamir)**: Proves authorization.
2. **Contract Entropy**: Proves the inheritance release event happened on-chain.
3. **Drand Beacon**: Proves that the specified time (Release Date) has actually passed, enforced by a decentralized threshold network.

## Proposed Changes

### Audit Findings (Edit Vault)
- **Decryption Breakage**: `use-vault-edit.ts` depends on fetching the secret from the blockchain's `releaseEntropy`. This will return `0x0` in our new model, breaking the current "Edit" flow unless we implement local secret discovery.
- **Missing Local Discovery**: The current code does not attempt to look in `localStorage` for the owner's secret.
- **Stale Metadata**: `submitEdit` currently re-uses old `contractEncryptedKey` from metadata, which will be invalid if the release date is modified during editing.
- **UI Gaps**: The Wizard UI doesn't have a fallback for when the owner is on a new device and needs to manually provide the `plainContractSecret` to unlock the vault for editing.

### 1. `clientVaultCrypto.ts` 
- Add `sealWithDrand(payload: Uint8Array, releaseDate: number): Promise<string>`
- Add `recoverWithDrand(sealedRecord: string): Promise<Uint8Array>`
- Update `deriveUnlockKey` to incorporate Drand signatures.

### 2. `use-vault-creation.ts`
- Generate `releaseSecret` locally.
- Use `tlock.seal` to wrap the `releaseSecret` for the specific `releaseDate`.
- Send `0x0` or a non-sensitive hash to the Bitxen contract's `secret` field.
- Store the `sealedSecret` in Arweave metadata (Safe because it's time-locked).

### 3. `use-vault-claim.ts`
- Fetch the `sealedSecret` from Arweave.
- Fetch the Drand beacon for the required ronde.
- Recover the `releaseSecret`.
- Combine with `releaseEntropy` from Bitxen to decrypt the main vault.

### 4. `use-vault-edit.ts` (Owner Access)
- **Local Secret Discovery**: The owner's browser will look for the `plainContractSecret` in `localStorage` keyed by `vaultId`.
- **Manual Secret Entry**: If `localStorage` is empty (e.g., cleared or different device), the Wizard will show a new step/prompt for the user to:
    - Paste the `Contract Secret` from their backup text.
    - OR Upload the `.json` backup file to extract the secret automatically.
- **Unwrapping**: Use the discovered `plainContractSecret` to unwrap the `envelopePayloadKey`.
- **Re-Sealing**: 
    - Provide a field to edit the `releaseDate` (if not already strictly implemented).
    - If the `releaseDate` is changed, recalculate the Drand ronde.
    - Re-seal the `plainContractSecret` with the new ronde and update Arweave metadata.

## Implementation TODO
- [ ] Install `tlock-js` and `drand-client` (check compatibility).
- [ ] Implement Drand utility functions in `lib/drand.ts`.
- [ ] Update `clientVaultCrypto.ts` with SEAL/RECOVER logic.
- [ ] Modify `useVaultCreation` to encrypt the `releaseSecret`.
- [ ] Modify `useVaultClaim` to retrieve and decrypt the `releaseSecret`.
- [ ] Test with a near-future release date to verify auto-unlock.

## Security Audit Points
- Ensure `drand` ronde calculation handles timezones correctly (UTC recommended).
- Verify that `releaseEntropy` from the contract is still used as a salt to ensure on-chain authorization is still required.
- Audit Arweave metadata to ensure no raw secrets are present.
