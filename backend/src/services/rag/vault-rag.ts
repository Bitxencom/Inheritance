import { fetchVaultPayloadById } from '../storage/arweave.js';
import { decryptPayload } from '../crypto/aes.js';
import { combineShares } from '../crypto/shamir.js';
import type { VaultPayload, EncryptedVault } from '../../types/vault.js';
import type { VaultRAGResult } from './types.js';

export class VaultRAG {
  /**
   * Retrieve relevant vaults based on query
   * 
   * @param query - Search query
   * @param vaultIds - Array of vault IDs to search
   * @param fractionKeys - Optional fraction keys for decryption (min 3)
   */
  async retrieveRelevantVaults(
    query: string,
    vaultIds: string[],
    fractionKeys?: string[]
  ): Promise<VaultRAGResult[]> {
    const results: VaultRAGResult[] = [];
    const queryLower = query.toLowerCase();
    
    for (const vaultId of vaultIds) {
      try {
        // Fetch encrypted vault from blockchain storage
        const uploadPayload = await fetchVaultPayloadById(vaultId);
        
        let content = '';
        let title = '';
        let canDecrypt = false;
        
        // If fraction keys provided, decrypt to get content
        if (fractionKeys && fractionKeys.length >= 3) {
          try {
            const masterKey = combineShares(fractionKeys);
            const decrypted = decryptPayload(
              uploadPayload.encryptedData as EncryptedVault,
              masterKey
            ) as VaultPayload;
            
            title = decrypted.willDetails.title;
            content = decrypted.willDetails.content;
            canDecrypt = true;
          } catch (error) {
            // Decrypt failed, use metadata only
            console.warn(`Cannot decrypt vault ${vaultId}:`, error);
          }
        }
        
        // If can't decrypt, use metadata
        if (!canDecrypt) {
          title = (uploadPayload.metadata?.title as string) || '';
          // Metadata can contain searchable information
          const metadataStr = JSON.stringify(uploadPayload.metadata || {});
          content = metadataStr;
        }
        
        // Calculate relevance score
        const relevanceScore = this.calculateRelevance(queryLower, title, content);
        
        if (relevanceScore > 0) {
          results.push({
            vaultId,
            source: `vault-${vaultId}`,
            title,
            content: content.substring(0, 500), // Limit length
            relevanceScore,
            canDecrypt,
          });
        }
      } catch (error) {
        console.error(`Error retrieving vault ${vaultId}:`, error);
      }
    }
    
    // Sort by relevance
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
  
  /**
   * Calculate relevance score for query
   */
  private calculateRelevance(
    query: string,
    title: string,
    content: string
  ): number {
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();
    
    let score = 0;
    
    // Title match is more important
    if (titleLower.includes(query)) score += 10;
    if (contentLower.includes(query)) score += 5;
    
    // Keyword matching
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 2;
      if (contentLower.includes(word)) score += 1;
    });
    
    return score;
  }
}

export const vaultRAG = new VaultRAG();

