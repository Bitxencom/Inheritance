export interface RAGSearchResult {
  source: string;
  content: string;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface VaultRAGResult extends RAGSearchResult {
  vaultId: string;
  title: string;
  canDecrypt: boolean;
}

export interface DocumentationRAGResult extends RAGSearchResult {
  file: string;
  chunkIndex: number;
}

export interface RAGQualityMetrics {
  hasResults: boolean;
  sourceCount: number;
  avgRelevanceScore: number;
  maxRelevanceScore: number;
  minRelevanceScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface RAGContext {
  vaults: VaultRAGResult[];
  documentation: DocumentationRAGResult[];
  combinedContext: string;
  quality?: RAGQualityMetrics;
}

