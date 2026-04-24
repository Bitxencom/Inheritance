
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { vaultRouter } from '../src/routes/vault';

// Mock dependencies
vi.mock('../src/services/storage/arweave', () => ({
  fetchVaultPayloadById: vi.fn(),
  estimateUploadCost: vi.fn().mockResolvedValue(0.001),
  getVaultUploadCostEstimate: vi.fn().mockResolvedValue({ costAR: 0.001, dataSizeBytes: 100 }),
}));

// Mock env to avoid issues
vi.mock('../src/config/env', () => ({
  appEnv: {
    shamirThreshold: 3,
    shamirTotalShares: 5,
  },
}));

import { fetchVaultPayloadById } from '../src/services/storage/arweave';

describe('Vault Security Bypass Vulnerability', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/vaults', vaultRouter);
    vi.clearAllMocks();
  });

  it('SHOULD REJECT unlock request when security questions are required but NOT provided', async () => {
    const vaultId = 'vulnerable-vault-id';

    // 1. Mock the vault payload returned from Arweave
    // This vault has security questions configured in metadata
    const mockPayload = {
      vaultId,
      encryptedData: {
        cipherText: 'encrypted-stuff',
        iv: 'iv',
        checksum: 'checksum'
      },
      metadata: {
        securityQuestionHashes: [
          { q: 'enc_q1', a: 'hash_a1' },
          { q: 'enc_q2', a: 'hash_a2' },
          { q: 'enc_q3', a: 'hash_a3' }
        ],
        encryptionVersion: 'v2-client'
      },
      latestTxId: 'tx-123'
    };

    (fetchVaultPayloadById as any).mockResolvedValue(mockPayload);

    // 2. Attempt to unlock WITHOUT providing securityQuestionAnswers
    // The vulnerability is that the backend only checks answers IF they are provided in the request body.
    const res = await request(app)
      .post(`/api/v1/vaults/${vaultId}/unlock`)
      .send({
        // NO securityQuestionAnswers provided
        // We might need other fields to pass schema validation?
        // Let's see route schema: arweaveTxId optional, claimNonce optional.
      });

    // 3. Assertions
    // IF VULNERABLE: This will be 200 OK
    // IF FIXED: This should be 400 Bad Request or 401 Unauthorized

    console.log(`Response status: ${res.status}`);
    console.log(`Response body:`, res.body);

    if (res.status === 200) {
      throw new Error('VULNERABILITY CONFIRMED: Backend allowed unlock without security answers!');
    }

    expect(res.status).not.toBe(200);
    expect(res.body.success).toBe(false);
  });
});
