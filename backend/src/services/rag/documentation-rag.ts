import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DocumentationRAGResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DocumentationRAG {
  private docs: Map<string, string> = new Map();
  private initialized = false;
  private fileTimestamps: Map<string, number> = new Map();
  
  /**
   * Initialize: Load all documentation from docs/ folder
   * ONLY load files from docs/ folder, NO fallback to project root
   * @param forceReload - Force reload even if already initialized
   */
  async initialize(forceReload: boolean = false): Promise<void> {
    if (this.initialized && !forceReload) return;
    
    // Find docs folder from project root.
    // __dirname location at runtime (dist): /app/dist/services/rag
    // Go up 3 levels to reach /app (not 4, to avoid jumping to /)
    const projectRoot = path.resolve(__dirname, '../../../');
    const docsPath = path.join(projectRoot, 'docs');
    
    // Dynamically load all .md files from docs/ folder
    // Auto detect new files without needing to update code
    console.log('📚 Scanning documentation folder for RAG...');
    
    // List all files in docs/ folder
    let docFiles: string[] = [];
    try {
      const files = await fs.readdir(docsPath);
      // Filter only .md files
      docFiles = files.filter(file => file.endsWith('.md'));
      console.log(`📁 Found ${docFiles.length} markdown files in docs/:`, docFiles.join(', '));
    } catch (error) {
      console.error('❌ Error reading docs folder:', error);
      // Fallback: return empty array if folder doesn't exist
      docFiles = [];
    }
    
    if (docFiles.length === 0) {
      console.warn('⚠️  No markdown files found in docs/ folder');
      this.initialized = true;
      return;
    }
    
    console.log('📚 Loading documentation for RAG...');
    
    for (const file of docFiles) {
      try {
        // Only load from docs/ folder, NO fallback to root
        // All documentation must be in docs/ folder for consistency
        const filePath = path.join(docsPath, file);
        
        if (await this.fileExists(filePath)) {
          // Check file modification time to detect changes
          const stats = await fs.stat(filePath);
          const lastModified = stats.mtimeMs;
          const cachedTime = this.fileTimestamps.get(file);
          
          // Skip if file has not changed (unless force reload)
          if (!forceReload && cachedTime && cachedTime >= lastModified) {
            console.log(`  ⏭️  Skipping ${file} (no changes detected)`);
            continue;
          }
          
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Remove old chunks for this file
          if (forceReload || cachedTime) {
            const keysToDelete: string[] = [];
            for (const key of this.docs.keys()) {
              if (key.startsWith(`${file}-chunk-`)) {
                keysToDelete.push(key);
              }
            }
            keysToDelete.forEach(key => this.docs.delete(key));
          }
          
          // Split into chunks (500 characters per chunk)
          const chunks = this.splitIntoChunks(content, 500);
          
          chunks.forEach((chunk, index) => {
            const key = `${file}-chunk-${index}`;
            this.docs.set(key, chunk);
          });
          
          // Update timestamp
          this.fileTimestamps.set(file, lastModified);
          
          console.log(`  ✅ Loaded ${chunks.length} chunks from ${file}${forceReload ? ' (forced reload)' : ''}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Could not load ${file}:`, error);
      }
    }
    
    this.initialized = true;
    console.log(`✅ Documentation RAG initialized with ${this.docs.size} chunks`);
  }
  
  /**
   * Search documentation based on query
   */
  async searchDocumentation(
    query: string,
    limit: number = 5,
    checkForChanges: boolean = true
  ): Promise<DocumentationRAGResult[]> {
    await this.initialize();
    
    // Auto-check for file changes before search (optional, can be disabled)
    if (checkForChanges && this.initialized) {
      await this.checkAndReloadChanged();
    }
    
    const queryLower = query.toLowerCase();
    const results: DocumentationRAGResult[] = [];
    
    for (const [key, content] of this.docs.entries()) {
      const contentLower = content.toLowerCase();
      
      // Calculate relevance score
      let score = 0;
      
      // Exact phrase match (highest score)
      if (contentLower.includes(queryLower)) {
        score += 10;
      }
      
      // Word matching
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      queryWords.forEach(word => {
        const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
        score += matches;
      });
      
      if (score > 0) {
        // Extract file name from key
        const file = key.split('-chunk-')[0];
        const chunkIndex = parseInt(key.split('-chunk-')[1] || '0');
        
        results.push({
          source: key,
          content: content.substring(0, 500), // Limit length
          relevanceScore: score,
          file,
          chunkIndex,
        });
      }
    }
    
    // Sort by relevance and return top results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }
  
  /**
   * Get context string for LLM from query
   */
  async getContextForQuery(query: string, limit: number = 3): Promise<string> {
    const results = await this.searchDocumentation(query, limit);
    
    if (results.length === 0) {
      return '';
    }
    
    return results
      .map((r, i) => `[Documentation ${i + 1} from ${r.file}]:\n${r.content}`)
      .join('\n\n---\n\n');
  }
  
  /**
   * Reload all documentation (force refresh)
   */
  async reload(): Promise<void> {
    console.log('🔄 Force reloading documentation...');
    this.initialized = false;
    await this.initialize(true);
    console.log('✅ Documentation reloaded');
  }
  
  /**
   * Check and reload changed files
   * Dynamically scan all .md files in docs/ folder
   */
  async checkAndReloadChanged(): Promise<boolean> {
    let hasChanges = false;
    
    const projectRoot = path.resolve(__dirname, '../../../../');
    const docsPath = path.join(projectRoot, 'docs');
    
    // Dynamically scan all .md files in docs/ folder
    let docFiles: string[] = [];
    try {
      const files = await fs.readdir(docsPath);
      docFiles = files.filter(file => file.endsWith('.md'));
    } catch (error) {
      // Ignore errors during checking
      return false;
    }
    
    for (const file of docFiles) {
      try {
        // Only check files in docs/ folder, no fallback to root
        const filePath = path.join(docsPath, file);
        
        if (await this.fileExists(filePath)) {
          const stats = await fs.stat(filePath);
          const lastModified = stats.mtimeMs;
          const cachedTime = this.fileTimestamps.get(file);
          
          if (!cachedTime || cachedTime < lastModified) {
            hasChanges = true;
            console.log(`📝 Detected changes in ${file}, reloading...`);
            break;
          }
        }
      } catch (error) {
        // Ignore errors during checking
      }
    }
    
    if (hasChanges) {
      await this.reload();
    }
    
    return hasChanges;
  }
  
  /**
   * Split text into chunks with specific size
   */
  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const documentationRAG = new DocumentationRAG();

