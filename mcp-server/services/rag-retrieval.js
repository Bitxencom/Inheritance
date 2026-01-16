// Use BACKEND_BASE_URL from environment, fallback to Docker internal hostname
const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, '') ||
  'http://backend:7002';

console.log(`🔧 MCP Server using BACKEND_BASE_URL: ${backendBaseUrl}`);

/**
 * Search documentation via backend API
 */
export async function searchDocumentation(query, limit = 5) {
  try {
    console.log(`📡 Calling backend RAG API: ${backendBaseUrl}/api/v1/rag/documentation/search`);
    console.log(`📝 Query: "${query}", Limit: ${limit}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    const response = await fetch(`${backendBaseUrl}/api/v1/rag/documentation/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Backend returned ${response.status}:`, errorText);
      throw new Error(`Backend returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Backend response success:`, data.success);
    console.log(`📊 Backend returned ${data.count || 0} results`);

    if (!data.success) {
      console.warn('⚠️ Backend returned success: false');
      return [];
    }

    const results = data.data || [];
    console.log(`📊 Found ${results.length} results`);

    if (results.length > 0) {
      console.log(`📄 First result:`, {
        file: results[0].file,
        source: results[0].source,
        contentLength: results[0].content?.length || 0,
      });
    }

    return results;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Request timeout while searching documentation');
      throw new Error('Request timeout: Backend did not respond within 10 seconds');
    }
    console.error('❌ Error searching documentation:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }
    throw error; // Re-throw so it can be handled in the handler
  }
}

/**
 * Search vault via backend API
 */
export async function searchVaults(query, vaultIds, fractionKeys = null, limit = 5) {
  try {
    const response = await fetch(`${backendBaseUrl}/api/v1/rag/vault/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, vaultIds, fractionKeys, limit }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error searching vaults:', error);
    return [];
  }
}

/**
 * Combined search (documentation + vault)
 */
export async function combinedSearch(query, vaultIds = null, fractionKeys = null) {
  try {
    const response = await fetch(`${backendBaseUrl}/api/v1/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        vaultIds: vaultIds || [],
        fractionKeys,
        docLimit: 3,
        vaultLimit: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    return data.data || { documentation: [], vaults: [], combinedContext: '' };
  } catch (error) {
    console.error('Error in combined search:', error);
    return { documentation: [], vaults: [], combinedContext: '' };
  }
}

