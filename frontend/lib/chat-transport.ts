"use client";

/**
 * Custom Chat Transport with Retry Logic
 * 
 * Adds automatic retry when HTTP 400 error occurs on chat request.
 * This addresses the issue where the second request after tool call fails with 400.
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOnStatus: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryOnStatus: [400, 429, 500, 502, 503, 504],
};

/**
 * Delay with exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Fetch with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If response OK, return immediately
      if (response.ok) {
        return response;
      }
      
      // Check if status code needs retry
      if (config.retryOnStatus.includes(response.status)) {
        console.warn(
          `⚠️ Chat request failed with status ${response.status}, attempt ${attempt + 1}/${config.maxRetries + 1}`
        );
        
        // If there are retries remaining
        if (attempt < config.maxRetries) {
          const delayMs = calculateDelay(attempt, config);
          console.log(`⏳ Retrying in ${Math.round(delayMs)}ms...`);
          await delay(delayMs);
          continue;
        }
      }
      
      // If no retry needed or retries exhausted, return response as-is
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Chat request error (attempt ${attempt + 1}):`, lastError.message);
      
      // Network error, try retry
      if (attempt < config.maxRetries) {
        const delayMs = calculateDelay(attempt, config);
        console.log(`⏳ Retry in ${Math.round(delayMs)}ms...`);
        await delay(delayMs);
        continue;
      }
      
      throw lastError;
    }
  }
  
  // Should not reach here, but for safety
  throw lastError || new Error("Max retries exceeded");
}

/**
 * Create custom fetch function for chat runtime with retry
 */
export function createRetryableFetch(config?: Partial<RetryConfig>) {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    
    // Only apply retry for /api/chat endpoint
    if (url.includes("/api/chat")) {
      return fetchWithRetry(url, init || {}, mergedConfig);
    }
    
    // For other endpoints, use regular fetch
    return fetch(input, init);
  };
}
