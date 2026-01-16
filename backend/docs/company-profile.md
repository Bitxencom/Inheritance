# Inheritance

## Your Digital Legacy Vault

---

![Inheritance Logo]

**"Secure your digital legacy easily and safely. Military-grade encryption, permanent storage on blockchain."**

---

## About Inheritance

Inheritance is a digital legacy vault platform that allows you to store and pass on important digital assets to your loved ones securely, easily, and affordably.

With blockchain technology and military-grade AES-256 encryption, Inheritance ensures your sensitive documents, passwords, and important files are protected forever—and can only be accessed by the beneficiaries you designate, at the right time.

---

## Problems We Solve

### 🔒 Your Digital Assets Are Not Protected

In the digital era, we store many important things:
- Bank and investment account passwords
- Crypto wallet recovery keys

**The important question:** *What if something happens to you? Can your family access these assets?*

### 💰 Traditional Solutions Are Too Expensive

| Traditional Method | Cost |
|-------------------|------|
| Notary & Lawyer | $300-3,000+ |
| Safe Deposit Box | $60-300/year |
| Digital Legacy Services | $30-120/year |

### 🏢 Centralized Services Are Risky

- Companies can go bankrupt or shut down
- Data can be hacked or misused
- Access depends on third parties
- No full privacy guarantee

---

## The Inheritance Solution

### ✨ Simple, Secure, Forever

Inheritance uses blockchain technology to provide a digital legacy solution that is:

| Feature | Inheritance |
|---------|-------------|
| **Cost** | Affordable, pay once |
| **Storage** | Permanent, no renewal needed |
| **Security** | AES-256 encryption + Shamir Secret Sharing |
| **Control** | 100% in your hands |

---

## How Inheritance Works

### 📝 Step 1: Create Your Vault

Create a vault through an intuitive chat interface:
- Important passwords
- Crypto recovery keys
- Personal messages for family

### 👥 Step 2: Create Security Questions

Create security questions for verification:
- Create 3-5 security questions with their answers
- Questions that are easy for you to remember but hard for others to guess

### ⏰ Step 3: Set Opening Time

Choose when the vault will open:

**Option A: Specific Date**
> Choose a future date (5/10/15/20 years or custom date)

**Option B: Anytime (Manual Release)**
> Vault can be opened anytime with the correct keys

### 💳 Step 4: Pay and Store

Make payment with **Wander Wallet (AR)**. After payment, your vault is active and permanently stored on the blockchain. **No monthly or annual fees.**

### 🔑 Step 5: Fraction Keys Distribution

After successful payment:
- Keep the **Inheritance ID** safe
- You will see **5 fraction keys** with copy buttons
- **Distribute at least 3 fraction keys** manually to different trusted individuals

---

## Technology Behind Inheritance

### � How Vault Creation Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VAULT CREATION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

     📝 YOUR DATA                                    🔐 SECURITY APPLIED
    ┌─────────────┐
    │  Vault      │
    │  Content    │ ─────────────────────────────────────────────────────┐
    │  + Title    │                                                      │
    └─────────────┘                                                      │
          │                                                              │
          ▼                                                              │
    ┌─────────────┐                                                      │
    │  Security   │  ──► Answers are hashed (SHA-256)                    │
    │  Questions  │      Questions are encrypted                         │
    └─────────────┘                                                      │
          │                                                              │
          ▼                                                              │
    ┌─────────────┐                                                      │
    │  Trigger    │  ──► Release date or manual mode                     │
    │  Settings   │                                                      │
    └─────────────┘                                                      │
          │                                                              │
          ▼                                                              ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                     🔒 ENCRYPTION PROCESS                                │
    ├─────────────────────────────────────────────────────────────────────────┤
    │                                                                         │
    │   Step 1: Generate AES-256 Key                                          │
    │            ↓                                                            │
    │   Step 2: Encrypt your data with AES-256           ◄── Layer 1          │
    │            ↓                                                            │
    │   Step 3: Generate PQC Key Pair (ML-KEM-768)                            │
    │            ↓                                                            │
    │   Step 4: Encrypt AES key with PQC Public Key      ◄── Layer 2          │
    │            ↓                                                            │
    │   Step 5: Split PQC Secret Key into 5 parts        ◄── Layer 3          │
    │            (Shamir's Secret Sharing)                                    │
    │            ↓                                                            │
    │   ┌─────┬─────┬─────┬─────┬─────┐                                       │
    │   │Key 1│Key 2│Key 3│Key 4│Key 5│  ──► 5 Fraction Keys                  │
    │   └─────┴─────┴─────┴─────┴─────┘      (distribute to trusted people)   │
    │                                                                         │
    └─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                     💳 PAYMENT (Wander Wallet)                          │
    └─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                     🌐 BLOCKCHAIN STORAGE                ◄── Layer 4   │
    ├─────────────────────────────────────────────────────────────────────────┤
    │   Encrypted vault stored permanently on blockchain                      │
    │   ✓ Immutable    ✓ Decentralized    ✓ Forever                          │
    └─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                     ✅ VAULT CREATED SUCCESSFULLY                        │
    ├─────────────────────────────────────────────────────────────────────────┤
    │   You receive:                                                          │
    │   • Vault ID (unique identifier)                                        │
    │   • 5 Fraction Keys (distribute at least 3 to trusted people)          │
    └─────────────────────────────────────────────────────────────────────────┘
```

### �🛡️ Layered Security

```
┌─────────────────────────────────────────────┐
│           Inheritance SECURITY LAYERS        │
├─────────────────────────────────────────────┤
│                                             │
│  Layer 1: AES-256 Encryption                │
│  ↓                                          │
│  Layer 2: Post-Quantum Encryption (ML-KEM)  │
│  ↓                                          │
│  Layer 3: Shamir's Secret Sharing           │
│  ↓                                          │
│  Layer 4: Blockchain Storage                │
│                                             │
└─────────────────────────────────────────────┘
```

**Think of it like securing a treasure:**

| Layer | What It Does | Analogy |
|-------|--------------|---------|
| **Layer 1: AES-256 Encryption** | Encrypts your data with military-grade encryption used by governments worldwide | 🏦 Like putting your treasure in an **unbreakable military safe** |
| **Layer 2: Post-Quantum Encryption** | Protects the safe's key from future quantum computer attacks using ML-KEM-768 | 🔮 Like adding a **future-proof lock** that even the most advanced computers can't pick |
| **Layer 3: Shamir's Secret Sharing** | Splits the decryption key into 5 parts, requiring 3 to unlock | 🗝️ Like breaking the key into **5 fragments** — you need at least 3 to reassemble it |
| **Layer 4: Blockchain Storage** | Stores your encrypted data permanently on the blockchain | 🌐 Like storing your safe in an **eternal, unchangeable vault** that exists everywhere |

> 💡 **Result**: To access your inheritance, someone would need to crack military-grade AES-256, break quantum-resistant encryption, collect at least 3 key fragments from different people, AND somehow alter the blockchain — which is practically impossible.

### 🔮 Post-Quantum Cryptography (PQC)

Inheritance uses **ML-KEM-768** (Module Lattice-based Key Encapsulation Mechanism), a NIST-approved post-quantum cryptographic algorithm:

- **Quantum-Resistant**: Protected against future quantum computer attacks
- **Hybrid Encryption**: ML-KEM-768 + AES-256 for maximum security
- **FIPS 203 Compliant**: Uses the latest NIST standardized algorithm
- **Enabled by Default**: All new vaults automatically use PQC protection

> 🔒 **Why PQC?** Quantum computers could potentially break current encryption in the future. By using post-quantum cryptography today, your inheritance data remains secure for decades to come.

### 🔐 AES-256 Encryption

Inheritance uses **AES-256**, a military-grade encryption standard used by governments and financial institutions worldwide. Your files are encrypted before being uploaded to the blockchain.

### 🔑 Shamir's Secret Sharing

Your vault decryption key is split into 5 parts using Shamir Secret Sharing technique:

| Part | Description |
|------|-------------|
| 5 Fraction Keys | Total keys generated |
| 3 of 5 | Minimum keys to open vault |

**Need 3 of 5 keys to open the vault** — ensuring extra security and preventing unauthorized access.

### 🌐 Permanent Storage on Blockchain Storage

Inheritance uses **blockchain** for permanent data storage:

- **Blockchain Storage**: Permanent encrypted storage
- Data stored forever without recurring costs
- Not dependent on company servers

---

## Inheritance Advantages

### ⚡ 1. Affordable

| Service | Cost |
|---------|------|
| **Inheritance** | **Pay once, store forever** |
| Traditional Notary | $300-600 + annual fees |
| Safe Deposit Box | $60-120/year |
| Digital Competitors | $30-60/year |

*Inheritance costs vary depending on data size and current blockchain price.*

### 🔐 2. Most Secure

- ✅ Post-Quantum encryption (ML-KEM-768) — future-proof against quantum attacks
- ✅ AES-256 encryption (military standard)
- ✅ Keys split into 5 with 3-of-5 threshold
- ✅ Permanent storage on blockchain
- ✅ Only recipients with correct keys can access

### 🎯 3. Easy to Use

- ✅ Intuitive chat interface with AI assistant
- ✅ No technical blockchain knowledge needed
- ✅ Quick and easy setup
- ✅ Step-by-step guidance

### ♾️ 4. Permanent Storage

- ✅ Pay once, store forever
- ✅ Files cannot be deleted or lost
- ✅ Blockchain guarantees data permanence

---

## User Flow

### 🏠 For Vault Owners

```
VAULT SETUP
━━━━━━━━━━━

1. 💬 Open Inheritance chat interface
          ↓
2. 📄 Fill in will details (title, content)
          ↓
3. 🔐 Create security questions (3-5 questions)
          ↓
4. ⏰ Set opening time
          ↓
5. 💳 Make payment (Wander Wallet)
          ↓
6. ✅ Save Inheritance ID & 5 Fraction Keys!
          ↓
7. 📤 Distribute at least 3 Fraction Keys to trusted individuals
```

### 👨‍👩‍👧 For Beneficiaries

```
CLAIM VAULT
━━━━━━━━━━━

1. ⏰ Opening time reached (if specific date)
          ↓
2. 📝 Enter Inheritance ID
          ↓
3. ❓ Answer security questions
          ↓
4. 🔑 Collect at least 3 fraction keys
          ↓
5. 🔓 Vault opens
          ↓
6. 📥 Download all files & documents
```

---

## Cost Transparency

### 💰 Cost Structure

Inheritance costs **vary depending on**:
- Will data size (content)
- Blockchain storage price at the time of creation

**Cost principles:**
- One-time payment, no recurring fees
- Larger document size means higher cost

---

## Frequently Asked Questions (FAQ)

### ❓ Are my files truly secure?

**Yes.** Your files are encrypted with AES-256 algorithm before upload. Only beneficiaries with the Inheritance ID, correct security question answers, and at least 3 fraction keys can access them.

### ❓ What if Inheritance shuts down?

**Your vault remains safe.** Files are stored on the decentralized blockchain. Data will persist even if our platform stops operating.

### ❓ Who can access my vault?

**Only those with the correct keys**, and only after trigger conditions are met (opening time reached). To open a vault, the following are required:
- Inheritance ID
- Correct security question answers
- At least 3 of 5 fraction keys

### ❓ Can I change the vault contents?

**Depends on the will type.** During creation, you can choose:
- **One-time (Permanent)**: Cannot be changed after creation
- **Editable**: Can be changed, but each change requires a new payment

### ❓ How do I distribute fraction keys?

After the will is successfully created, you will see **5 fraction keys** with copy buttons for each key. **Distribute manually** to at least 3 different trusted individuals through secure methods (encrypted email, secure messaging, or in person).

### ❓ How long does the setup process take?

The process is quick and simple through the chat interface with an AI assistant guiding you step by step.

### ❓ Is it legal?

Inheritance is a digital asset storage and transfer tool. We recommend users still consult with legal advisors for formal estate planning needs.

---

## What Can Be Bequeathed?

### Traditional Financial Assets
- Bank & savings account information
- Deposit & investment details
- Insurance information

### Digital Financial Assets
- E-wallet access: PayPal, Venmo, Cash App, etc.
- Cryptocurrency information: Bitcoin, Ethereum, etc.

### Digital & Online Assets
- Domain & website access
- Social media accounts: Facebook, Instagram, X (Twitter), TikTok, etc.
- Email accounts
- Cloud storage: Google Drive, iCloud, Dropbox, etc.
- Game accounts & virtual property
- NFT & digital collections

### Intellectual Property Rights
- Copyright: books, music, software, designs
- Digital royalty information

### Special Instructions & Messages
- Messages to family
- Funeral instructions
- Charity & endowment instructions
- Child guardian designation

---

## Start Now

### 🚀 Protect Your Digital Legacy Today

Don't let your passwords, important documents, and digital assets disappear. With Inheritance, you can ensure your loved ones receive what you leave behind.

---

### 📱 Start Creating Your Vault

1. Start chatting with the AI assistant
2. Follow the guide to create your vault
3. Safely store the Inheritance ID and 5 fraction keys
4. Distribute at least 3 fraction keys to trusted individuals

---

## Summary

> **Inheritance** is a digital legacy vault solution that combines:
> 
> - � **Quantum-Proof Security** — ML-KEM-768 Post-Quantum encryption for future-proof protection
> - �🔐 **Maximum Security** — AES-256 encryption + Shamir's Secret Sharing (3-of-5)
> - 💰 **Affordable Cost** — Pay once, no recurring fees
> - ♾️ **Permanent Storage** — stored on blockchain forever
> - 🎯 **Ease of Use** — Chat interface with AI assistant
> 
> **Secure your digital legacy. Protect those you love.**

---

*© 2025 Inheritance. All rights reserved.*

*This document is for informational purposes only and does not constitute legal or financial advice.*
