import { Router } from 'express';
import { z } from 'zod';
import { documentationRAG, vaultRAG } from '../services/rag/index.js';
import type { RAGQualityMetrics } from '../services/rag/types.js';

export const ragRouter = Router();

/**
 * Calculate quality metrics from RAG results
 */
function calculateQualityMetrics(
  results: Array<{ relevanceScore: number }>
): RAGQualityMetrics {
  if (results.length === 0) {
    return {
      hasResults: false,
      sourceCount: 0,
      avgRelevanceScore: 0,
      maxRelevanceScore: 0,
      minRelevanceScore: 0,
      confidence: 'low',
    };
  }

  const scores = results.map(r => r.relevanceScore);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low';
  if (results.length >= 2 && avgScore >= 5 && maxScore >= 10) {
    confidence = 'high';
  } else if (results.length >= 1 && avgScore >= 3) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    hasResults: true,
    sourceCount: results.length,
    avgRelevanceScore: Math.round(avgScore * 100) / 100, // Round to 2 decimals
    maxRelevanceScore: maxScore,
    minRelevanceScore: minScore,
    confidence,
  };
}

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

// Search documentation
ragRouter.post('/documentation/search', async (req, res, next) => {
  try {
    const { query, limit } = searchSchema.parse(req.body);
    
    // Auto-check for file changes before search
    const results = await documentationRAG.searchDocumentation(query, limit, true);
    
    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    next(error);
  }
});

// Reload documentation (manual refresh)
ragRouter.post('/documentation/reload', async (req, res, next) => {
  try {
    await documentationRAG.reload();
    res.json({
      success: true,
      message: 'Documentation reloaded successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Search vault (requires vaultIds and optional fractionKeys)
const vaultSearchSchema = z.object({
  query: z.string().min(1),
  vaultIds: z.array(z.string().uuid()).min(1),
  fractionKeys: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

ragRouter.post('/vault/search', async (req, res, next) => {
  try {
    const { query, vaultIds, fractionKeys, limit } = vaultSearchSchema.parse(req.body);
    
    // Validate fraction keys if provided
    if (fractionKeys && fractionKeys.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'At least 3 fraction keys are required to decrypt vault',
      });
    }
    
    const results = await vaultRAG.retrieveRelevantVaults(
      query,
      vaultIds,
      fractionKeys
    );
    
    res.json({
      success: true,
      data: results.slice(0, limit),
      count: results.length,
    });
  } catch (error) {
    next(error);
  }
});

// Combined search (documentation + vault)
const combinedSearchSchema = z.object({
  query: z.string().min(1, { message: 'Query cannot be empty' }).trim(),
  vaultIds: z.array(z.string().uuid()).optional(),
  fractionKeys: z.array(z.string()).optional(),
  docLimit: z.number().int().min(1).max(10).optional().default(3),
  vaultLimit: z.number().int().min(1).max(10).optional().default(5),
});

ragRouter.post('/search', async (req, res, next) => {
  try {
    // Log request for debugging
    console.log('📥 RAG search request:', {
      query: req.body.query?.substring(0, 50),
      hasVaultIds: !!req.body.vaultIds,
      vaultIdsCount: req.body.vaultIds?.length || 0,
    });
    
    const { query, vaultIds, fractionKeys, docLimit, vaultLimit } = 
      combinedSearchSchema.parse(req.body);
    
    // Search documentation (auto-check for file changes)
    const docResults = await documentationRAG.searchDocumentation(query, docLimit, true);
    
    // Search vault if vaultIds provided
    let vaultResults: Awaited<ReturnType<typeof vaultRAG.retrieveRelevantVaults>> = [];
    if (vaultIds && vaultIds.length > 0) {
      if (fractionKeys && fractionKeys.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'At least 3 fraction keys are required to decrypt vault',
        });
      }
      vaultResults = await vaultRAG.retrieveRelevantVaults(
        query,
        vaultIds,
        fractionKeys
      );
    }
    
    // Combine context
    const docContext = docResults
      .map((r, i) => `[Documentation ${i + 1} from ${r.file}]:\n${r.content}`)
      .join('\n\n---\n\n');
    
    const vaultContext = vaultResults
      .slice(0, vaultLimit)
      .map((r, i) => `[Vault ${i + 1}: ${r.title}]:\n${r.content}`)
      .join('\n\n---\n\n');
    
    const combinedContext = [docContext, vaultContext]
      .filter(c => c.length > 0)
      .join('\n\n---\n\n');
    
    // Calculate quality metrics
    const allResults = [...docResults, ...vaultResults.slice(0, vaultLimit)];
    const quality: RAGQualityMetrics = calculateQualityMetrics(allResults);
    
    res.json({
      success: true,
      data: {
        documentation: docResults,
        vaults: vaultResults.slice(0, vaultLimit),
        combinedContext,
        quality,
      },
    });
  } catch (error) {
    next(error);
  }
});

