# Detailed Guide for Creating a Vault

Complete technical guide for the vault creation form using VaultCreationWizard.

> 📖 For general information about services, see [Vault Services](./service.md)

## Step 1 – Vault Details (`VaultDetailsStep`)

Input form for basic vault details:

- **`willType`** (radio button):
  - `one-time`: Permanent vault, cannot be changed
  - `editable`: Vault can be changed in the future
- **`title`** (text input): Vault title/name
- **`content`** (textarea): Vault content (long text)


## Step 2 – Security Questions (`SecurityQuestionStep`)

Creating security questions for verification:

- **`securityQuestions`** (array, min 3, max 5 items):
  - **`question`** (text input): Security question
  - **`answer`** (text input): Answer to the question

> 💡 Create questions that are easy for you to remember but hard for others to guess.

## Step 3 – Opening Time (`TriggerReleaseStep`)

Determining when the inheritance can be opened:

- **`triggerType`** (radio button):
  - **`manual`**: Opening anytime with the correct keys
  - **`date`**: Opening on a specific date
    - Quick options: 5/10/15/20 years from now buttons
    - **`triggerDate`** (custom date input): Must be greater than today

## Step 4 – Review (`ReviewStep`)

Displaying a summary of all entered data:

- No new input
- Displays all information from previous steps
- Make sure all data is correct before proceeding

## Step 5 – Payment (`PaymentStep`)

Choosing a payment method:

- **`paymentMethod`**: `wander` (Wander Wallet)

  **If `wander` is selected:**
  - Payment using AR token via Wander Wallet
  - No additional input, just click the payment button
  - Confirm transaction in Wander Wallet popup

## Result After Successful Payment

Displaying results after successful payment:

- Displays:
  - **Vault ID**: Unique inheritance identifier (copy to save)
  - **5 Fraction Keys**: Encryption keys with copy button for each key
- Available actions:
  - Copy Vault ID
  - Copy each Fraction Key
  - Download information (Vault ID + Fraction Keys)
  - Done

> ⚠️ **IMPORTANT**: Store Vault ID and all 5 Fraction Keys safely! Distribute at least 3 fraction keys to different trusted individuals.

## Important Tips

1. **Store Information Safely**: Vault ID and 5 Fraction Keys must be stored in a safe place
2. **Distribute Fraction Keys**: Make sure at least 3 fraction keys are distributed to different trusted individuals
3. **Choose Vault Type Wisely**: One-time for final vault, Editable for vault that may need updates
4. **Create Memorable Security Questions**: You will need to answer these questions when opening the vault
5. **Review Before Paying**: Make sure all data is correct in the review step
