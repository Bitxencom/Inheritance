export { documentationRAG } from './documentation-rag.js';
export { vaultRAG } from './vault-rag.js';
export type {
  RAGSearchResult,
  VaultRAGResult,
  DocumentationRAGResult,
  RAGContext,
} from './types.js';

import { documentationRAG } from './documentation-rag.js';

// Export reload method for manual refresh
export const reloadDocumentation = () => documentationRAG.reload();
export const checkDocumentationChanges = () => documentationRAG.checkAndReloadChanged();

