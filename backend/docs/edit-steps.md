# Detailed Guide for Editing a Vault

Complete technical guide for the vault edit form using VaultEditWizard.

> 📖 For general information about services, see [Vault Services](./service.md)
> ⚠️ **Note**: Only vaults created with `willType: "editable"` can be modified.

## Step 1 – Inheritance ID (`vaultId`)

Input the vault identifier to edit:

- **`vaultId`** (text input): The Inheritance ID of the vault you want to edit
- System will verify and load existing vault data

> 💡 Only editable vaults can be modified. One-time vaults are permanent.

## Step 2 – Security Questions (`securityQuestion`)

Answer security questions for verification:

- **`securityQuestionAnswers`** (array of answers):
  - Answer all security questions you created when making the vault
  - All answers must be correct to proceed

## Step 3 – Fraction Keys (`fractionKeys`)

Enter encryption keys for verification:

- **`key1`** (text input): First fraction key
- **`key2`** (text input): Second fraction key  
- **`key3`** (text input): Third fraction key

> 📌 You need at least 3 of 5 fraction keys to edit the vault.

## Step 4 – Update Content (`willDetails`)

Modify the vault content:

- **`title`** (text input): Update vault title
- **`content`** (textarea): Update vault content/message

> 💡 The original content will be loaded for you to modify.

## Step 5 – Edit Security Questions (`editSecurityQuestions`)

Optional: Modify security questions:

- Add new security questions (max 5 total)
- Modify existing questions and answers
- Remove questions (minimum 3 required)

> ⚠️ If you change security questions, beneficiaries will need the new answers to claim.

## Step 6 – Confirm Changes (`confirm`)

Review all changes before payment:

- Displays all modified information
- Compare original vs new content
- Confirm changes are correct

## Step 7 – Payment (`payment`)

Pay to save updated vault:

- **`paymentMethod`**: `wander` (Wander Wallet)
  - Payment using AR token via Wander Wallet
  - Confirm transaction in Wander Wallet popup

> 💰 **Note**: Editing a vault requires payment similar to creating a new vault, as updated data needs to be re-stored on blockchain.

## Result After Successful Edit

After successfully editing the vault:

- Displays:
  - **New Transaction ID**: Updated blockchain transaction reference
  - **Confirmation**: Edit success message
- Important notices:
  - Changes may take time to be confirmed on blockchain
  - Previous version may still be accessible until confirmation

> ⚠️ **IMPORTANT**: 
> - Fraction keys remain the same after editing
> - If you changed security questions, notify beneficiaries of the new answers
> - There may be a delay before changes are visible due to blockchain confirmation time

## Important Tips

1. **Backup Before Editing**: Note your current vault content before making changes
2. **Verify Changes**: Carefully review all changes in the confirm step
3. **Notify Beneficiaries**: If security questions changed, ensure beneficiaries know the new answers
4. **Wait for Confirmation**: Allow time for blockchain to confirm the updated transaction
5. **Keep Fraction Keys Safe**: Your fraction keys don't change after editing
