#!/usr/bin/env npx tsx

import { Command } from 'commander';
import chalk from 'chalk';
import secrets from 'secrets.js-grempe';
import crypto from 'crypto';

const program = new Command();

/**
 * 🛠️ CORE CRYPTO FUNCTIONS (Ported for CLI)
 * These match the logic in backend/src/services/vault-service.ts
 */

const deriveKeyFromVaultId = (vaultId: string): Buffer => {
    const salt = "wishlist-ai-security-questions-v1";
    return crypto.pbkdf2Sync(vaultId, salt, 100000, 32, "sha256");
};

const decryptMetadata = (encryptedData: string, vaultId: string): any => {
    const key = deriveKeyFromVaultId(vaultId);
    if (encryptedData.startsWith("v3:")) {
        const raw = Buffer.from(encryptedData.slice("v3:".length), "base64");
        const iv = raw.subarray(0, 12);
        const tag = raw.subarray(12, 28);
        const data = raw.subarray(28);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(Buffer.from(vaultId, "utf8"));
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        return JSON.parse(decrypted.toString("utf8"));
    }

    // Fallback for v1 (CBC)
    const buffer = Buffer.from(encryptedData, "base64");
    const iv = buffer.subarray(0, 16);
    const encrypted = buffer.subarray(16);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
};

const decryptPayload = (encrypted: any, key: Buffer): any => {
    const iv = Buffer.from(encrypted.iv, "base64");
    const cipherBuffer = Buffer.from(encrypted.cipherText, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const plain = Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
};

program
    .name('decrypt-vault')
    .description('Manually reconstruct secret and decrypt vault content')
    .requiredOption('-i, --id <vaultId>', 'The Pulse/Vault ID')
    .requiredOption('-s, --shares <shares>', 'Comma-separated fraction keys (at least 3)')
    .option('-t, --tx <txId>', 'Arweave Transaction ID (to fetch content automatically)')
    .option('-f, --file <path>', 'JSON file containing the encrypted payload')
    .action(async (options) => {
        const { id: vaultId, shares: sharesRaw, tx: txId, file: filePath } = options;
        const shares = sharesRaw.split(',').map((s: string) => s.trim());

        console.log(chalk.blue.bold(`\n🛠️  Vault Decryption Tool`));
        console.log(`Vault ID: ${chalk.cyan(vaultId)}`);
        console.log(`Shares Provided: ${chalk.yellow(shares.length)}`);

        try {
            // 1. Reconstruct Secret Key
            console.log(chalk.gray('Combining shares...'));
            const combinedHex = secrets.combine(shares);
            const secretKey = Buffer.from(combinedHex, 'hex');
            console.log(chalk.green('✅ Secret key reconstructed successfully.'));

            // 2. Obtain Encrypted Data
            let encryptedPayload: any = null;

            if (txId) {
                console.log(chalk.gray(`Fetching data from Arweave tx: ${txId}...`));
                const response = await fetch(`https://arweave.net/${txId}`);
                if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                encryptedPayload = await response.json();
            } else if (filePath) {
                const fs = await import('fs');
                const raw = fs.readFileSync(filePath, 'utf8');
                encryptedPayload = JSON.parse(raw);
            } else {
                throw new Error('Please provide either --tx or --file to get the encrypted content.');
            }

            // 3. Process the Payload
            // Standard Deheritance format: { id, v, t, m, d }
            // m = encrypted metadata, d = encrypted data

            const rawMetadata = encryptedPayload.m || encryptedPayload.metadata;
            const rawData = encryptedPayload.d || encryptedPayload.encryptedData || encryptedPayload;

            // Decrypt Metadata if available
            if (rawMetadata && typeof rawMetadata === 'string') {
                try {
                    console.log(chalk.gray('Decrypting metadata...'));
                    const meta = decryptMetadata(rawMetadata, vaultId);
                    console.log(chalk.white.bold('\n--- Metadata ---'));
                    console.log(JSON.stringify(meta, null, 2));
                } catch (e: any) {
                    console.log(chalk.red(`⚠️  Metadata decryption failed: ${e.message}`));
                }
            }

            // Decrypt Main Content
            console.log(chalk.gray('\nDecrypting vault content...'));

            // If PQC is enabled, the reconstructed key is the ML-KEM secret key
            // and we need additional decapsulation. For now, assuming classic AES mode.
            // If shares.length reconstructed a key that is the direct AES key:

            try {
                const decrypted = decryptPayload(rawData, secretKey);
                console.log(chalk.green.bold('\n✅ DECRYPTION SUCCESSFUL!'));
                console.log(chalk.white.bold('\n--- Vault Content ---'));
                console.log(JSON.stringify(decrypted, null, 2));
            } catch (e: any) {
                console.log(chalk.red(`\n❌ Decryption failed: ${e.message}`));
                console.log(chalk.yellow('Possible causes:'));
                console.log(`- Incorrect vaultId (used for metadata). Current ID: ${vaultId}`);
                console.log('- Shares do not match the key used to encrypt this specific vault.');
                console.log('- Vault might be in PQC/Hybrid mode (requires ML-KEM decapsulation).');
            }

        } catch (error: any) {
            console.error(chalk.red(`\n💥 Error: ${error.message}`));
        }
        console.log('\n');
    });

program.parse();
