# Detailed Guide for Claiming a Vault

Complete technical guide for the vault claim form using VaultClaimWizard.

> 📖 For general information about services, see [Vault Services](./service.md)

## Step 1 – Inheritance ID (`vaultId`)

Input the unique vault identifier:

- **`vaultId`** (text input): The Inheritance ID received from the vault owner
- After entering the ID, the system will verify and load security questions

> 💡 Make sure you have the correct Inheritance ID from the vault owner.

## Step 2 – Security Questions (`verification`)

Answering security questions for verification:

- **`securityQuestionAnswers`** (array of answers):
  - Answer all security questions created by the vault owner
  - All answers must be correct to proceed

> ⚠️ Answers are case-sensitive and must match exactly.

## Step 3 – Fraction Keys (`fractionKeys`)

Enter the encryption keys to decrypt the vault:

- **`key1`** (text input): First fraction key
- **`key2`** (text input): Second fraction key
- **`key3`** (text input): Third fraction key

> 📌 You need at least 3 of 5 fraction keys to unlock the vault.

## Step 4 – Unlock Vault (`unlock`)

Final step to access the inheritance content:

- System validates trigger release conditions:
  - **`manual`**: Can be opened immediately
  - **`date`**: Must wait until the specified date
- Click "Open Inheritance" to decrypt and view content

## Result After Successful Unlock

After successfully unlocking the vault:

- Displays:
  - **Vault Title**: The title of the inheritance
  - **Vault Content**: The full inheritance content/message
  - **Documents**: Any attached files (if available)
- Available actions:
  - View inheritance content
  - Download documents
  - Done

> ⚠️ **IMPORTANT**: Keep the inheritance content secure and private.

## Important Tips

1. **Get All Required Information**: Ensure you have the Inheritance ID and at least 3 fraction keys
2. **Answer Questions Accurately**: Security question answers must be exact matches
3. **Check Release Date**: If the vault has a specific date trigger, you must wait until that date
4. **Secure Environment**: Access the inheritance in a secure, private environment
5. **Backup Content**: Consider saving the inheritance content securely after accessing it
