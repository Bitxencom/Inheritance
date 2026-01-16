import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AIQualityMetrics {
  timestamp: string;
  query: string;
  hasRAGContext: boolean;
  sourceCount: number;
  avgRelevanceScore: number;
  maxRelevanceScore: number;
  minRelevanceScore: number;
  confidence: 'high' | 'medium' | 'low';
  responseLength: number;
  hasUncertaintyPhrases: boolean;
  uncertaintyPhrases?: string[];
  toolCalls?: string[];
  responseTime?: number;
}

export class AIQualityLogger {
  private logsDir: string;
  private currentDate: string = '';
  private currentLogFile: string = '';

  constructor() {
    // Set logs directory at project root (go up 3 levels from backend/src/services)
    const projectRoot = path.resolve(__dirname, '../../../../');
    this.logsDir = path.join(projectRoot, 'logs');
    this.updateLogFile();
  }

  /**
   * Update log file based on today's date
   */
  private updateLogFile(): void {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.currentLogFile = path.join(this.logsDir, `ai-quality-${today}.log`);
    }
  }

  /**
   * Ensure logs directory exists
   */
  private async ensureLogsDir(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error) {
      console.error('❌ Error creating logs directory:', error);
    }
  }

  /**
   * Log AI quality metrics to file
   */
  async logQuality(metrics: AIQualityMetrics): Promise<void> {
    try {
      this.updateLogFile();
      await this.ensureLogsDir();

      // Format log entry as JSON (one line per entry for easy parsing)
      const logEntry = JSON.stringify(metrics);
      
      // Append to today's log file
      await fs.appendFile(this.currentLogFile, logEntry + '\n', 'utf-8');
    } catch (error) {
      console.error('❌ Error logging AI quality:', error);
      // Don't throw error, logging must not disrupt main flow
    }
  }

  /**
   * Calculate confidence level based on metrics
   */
  static calculateConfidence(metrics: {
    hasRAGContext: boolean;
    sourceCount: number;
    avgRelevanceScore: number;
    hasUncertaintyPhrases: boolean;
  }): 'high' | 'medium' | 'low' {
    // High confidence: has context, many sources, high score, no uncertainty
    if (
      metrics.hasRAGContext &&
      metrics.sourceCount >= 2 &&
      metrics.avgRelevanceScore >= 5 &&
      !metrics.hasUncertaintyPhrases
    ) {
      return 'high';
    }

    // Low confidence: no context or many uncertainty phrases
    if (
      !metrics.hasRAGContext ||
      metrics.sourceCount === 0 ||
      (metrics.hasUncertaintyPhrases && metrics.avgRelevanceScore < 3)
    ) {
      return 'low';
    }

    // Medium confidence: between high and low
    return 'medium';
  }

  /**
   * Detect uncertainty phrases in response
   */
  static detectUncertainty(response: string): {
    hasUncertainty: boolean;
    phrases: string[];
  } {
    const uncertaintyPhrases = [
      'i am not sure',
      'i do not know',
      'not sure',
      'might',
      'maybe',
      'could be',
      'did not find',
      'no information',
      'sorry, no',
      'haven\'t found',
      'cannot find',
      'not available',
      'no data',
      'lack of information',
      'limited information',
    ];

    const responseLower = response.toLowerCase();
    const foundPhrases: string[] = [];

    uncertaintyPhrases.forEach(phrase => {
      if (responseLower.includes(phrase)) {
        foundPhrases.push(phrase);
      }
    });

    return {
      hasUncertainty: foundPhrases.length > 0,
      phrases: foundPhrases,
    };
  }
}

export const aiQualityLogger = new AIQualityLogger();

