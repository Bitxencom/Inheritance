import { Router } from 'express';
import { z } from 'zod';
import { aiQualityLogger } from '../services/ai-quality-logger.js';

export const aiQualityRouter = Router();

const logQualitySchema = z.object({
  timestamp: z.string(),
  query: z.string(),
  hasRAGContext: z.boolean(),
  sourceCount: z.number(),
  avgRelevanceScore: z.number(),
  maxRelevanceScore: z.number(),
  minRelevanceScore: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  responseLength: z.number(),
  hasUncertaintyPhrases: z.boolean(),
  uncertaintyPhrases: z.array(z.string()).optional(),
  toolCalls: z.array(z.string()).optional(),
  responseTime: z.number().optional(),
  ragResponseTime: z.number().optional(),
});

// Endpoint for logging AI quality
aiQualityRouter.post('/log', async (req, res, next) => {
  try {
    const metrics = logQualitySchema.parse(req.body);
    
    // Log to file (async, non-blocking)
    aiQualityLogger.logQuality(metrics).catch((err) => {
      console.warn('⚠️ Failed to write quality log:', err);
    });
    
    res.json({
      success: true,
      message: 'Quality metrics logged',
    });
  } catch (error) {
    next(error);
  }
});

