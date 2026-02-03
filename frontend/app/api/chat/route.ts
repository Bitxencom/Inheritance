import { deepseek } from "@ai-sdk/deepseek";
import {
  convertToModelMessages,
  jsonSchema,
  streamText,
  tool,
  UIMessage,
} from "ai";

import { getMCPTools } from "@/app/api/_lib/mcp-client";

// Helper function to get RAG context with quality metrics
async function getRAGContext(
  lastUserMessage: string,
  vaultIds?: string[]
): Promise<{ context: string; quality?: unknown }> {
  try {
    const backendUrl = process.env.BACKEND_BASE_URL || 'http://localhost:7002';
    const ragUrl = `${backendUrl}/api/v1/rag/search`;
    
    console.log(`📡 Calling RAG API: ${ragUrl}`);
    console.log(`📝 Query: "${lastUserMessage.substring(0, 50)}..."`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
    
    const response = await fetch(ragUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: lastUserMessage,
        vaultIds: vaultIds || [],
        docLimit: 3,
        vaultLimit: 3,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ RAG search failed (${response.status}):`, errorText.substring(0, 200));
      console.warn(`📡 Backend URL: ${backendUrl}`);
      console.warn(`🔗 RAG endpoint: ${ragUrl}`);
      return { context: '', quality: undefined };
    }
    
    const data = await response.json();
    const context = data.data?.combinedContext || '';
    const quality = data.data?.quality;
    
    if (context) {
      console.log(`✅ RAG context loaded (${context.length} chars)`);
    } else {
      console.log(`ℹ️ RAG context empty (no relevant results)`);
    }
    
    return { context, quality };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn('⏱️ RAG search timeout (10s), continuing without context');
      } else {
        console.error('❌ Error getting RAG context:', error.message);
        console.error('📡 Backend URL:', process.env.BACKEND_BASE_URL || 'http://localhost:7002');
      }
    } else {
      console.error('❌ Unknown error getting RAG context:', error);
    }
    return { context: '', quality: undefined };
  }
}

type OpenVaultWizardArgs = {
  reason?: string;
  metadata?: Record<string, unknown>;
};

type OpenVaultWizardResult = {
  status: "vault_wizard_triggered";
  reason: string | null;
  metadata: Record<string, unknown> | null;
  openedAt: string;
};

const openVaultWizardTool = tool<OpenVaultWizardArgs, OpenVaultWizardResult>({
  description:
    "IMPORTANT: This tool is for CREATING a new vault. Use this tool when the user wants to create a new vault or save a vault. DO NOT use this tool if the user only asks about cost or cost estimation. For cost questions, use the `estimate_arweave_cost` tool.",
  inputSchema: jsonSchema<OpenVaultWizardArgs>({
    type: "object",
    properties: {
      reason: {
        type: "string",
        description:
          "Short reason why the form needs to be opened (e.g., user requested to create a vault).",
      },
      metadata: {
        type: "object",
        description:
          "Optional additional information to help the UI prefill.",
        additionalProperties: true,
      },
    },
    additionalProperties: false,
  }),
  execute: async ({
    reason,
    metadata,
  }: OpenVaultWizardArgs): Promise<OpenVaultWizardResult> => {
    return {
      status: "vault_wizard_triggered",
      reason: reason ?? null,
      metadata: metadata ?? null,
      openedAt: new Date().toISOString(),
    };
  },
});

type OpenVaultClaimWizardArgs = {
  reason?: string;
  metadata?: Record<string, unknown>;
};

type OpenVaultClaimWizardResult = {
  status: "vault_claim_wizard_triggered";
  reason: string | null;
  metadata: Record<string, unknown> | null;
  openedAt: string;
};

const openVaultClaimWizardTool = tool<
  OpenVaultClaimWizardArgs,
  OpenVaultClaimWizardResult
>({
  description:
    "Request the UI to open the inheritance claim form / unlock the vault when the user wants to access the vault content.",
  inputSchema: jsonSchema<OpenVaultClaimWizardArgs>({
    type: "object",
    properties: {
      reason: {
        type: "string",
        description:
          "Short reason why the inheritance claim form needs to be opened (e.g., user requested to open/unlock the vault).",
      },
      metadata: {
        type: "object",
        description:
          "Optional additional information to help the UI prefill (e.g., Vault ID).",
        additionalProperties: true,
      },
    },
    additionalProperties: false,
  }),
  execute: async ({
    reason,
    metadata,
  }: OpenVaultClaimWizardArgs): Promise<OpenVaultClaimWizardResult> => {
    return {
      status: "vault_claim_wizard_triggered",
      reason: reason ?? null,
      metadata: metadata ?? null,
      openedAt: new Date().toISOString(),
    };
  },
});

type OpenVaultEditWizardArgs = {
  reason?: string;
  metadata?: Record<string, unknown>;
};

type OpenVaultEditWizardResult = {
  status: "vault_edit_wizard_triggered";
  reason: string | null;
  metadata: Record<string, unknown> | null;
  openedAt: string;
};

const openVaultEditWizardTool = tool<
  OpenVaultEditWizardArgs,
  OpenVaultEditWizardResult
>({
  description:
    "Request the UI to open the form for editing an existing vault (using Vault ID and fraction keys).",
  inputSchema: jsonSchema<OpenVaultEditWizardArgs>({
    type: "object",
    properties: {
      reason: {
        type: "string",
        description:
          "Short reason why the edit form needs to be opened (e.g., user requested to change vault content/title).",
      },
      metadata: {
        type: "object",
        description:
          "Optional additional information to help the UI prefill (e.g., Vault ID).",
        additionalProperties: true,
      },
    },
    additionalProperties: false,
  }),
  execute: async ({
    reason,
    metadata,
  }: OpenVaultEditWizardArgs): Promise<OpenVaultEditWizardResult> => {
    return {
      status: "vault_edit_wizard_triggered",
      reason: reason ?? null,
      metadata: metadata ?? null,
      openedAt: new Date().toISOString(),
    };
  },
});

type EstimateArweaveCostArgs = {
  reason?: string;
  metadata?: Record<string, unknown>;
};

type EstimateArweaveCostResult = {
  status: "cost_estimation_triggered";
  reason: string | null;
  metadata: Record<string, unknown> | null;
  openedAt: string;
};

const estimateArweaveCostTool = tool<
  EstimateArweaveCostArgs,
  EstimateArweaveCostResult
>({
  description:
    "IMPORTANT: This tool is ONLY for calculating the cost estimation for uploading to blockchain storage, NOT for creating a vault. Use this tool WHEN the user asks about costs, prices, or blockchain storage upload cost estimation. DO NOT use this tool if the user wants to create a vault. This tool will open a separate cost estimation form different from vault creation form.",
  inputSchema: jsonSchema<EstimateArweaveCostArgs>({
    type: "object",
    properties: {
      reason: {
        type: "string",
        description:
          "Short reason why the cost estimation form needs to be opened (e.g., user asked about blockchain storage upload costs).",
      },
      metadata: {
        type: "object",
        description:
          "Optional additional information to help the UI prefill.",
        additionalProperties: true,
      },
    },
    additionalProperties: false,
  }),
  execute: async ({
    reason,
    metadata,
  }: EstimateArweaveCostArgs): Promise<EstimateArweaveCostResult> => {
    return {
      status: "cost_estimation_triggered",
      reason: reason ?? null,
      metadata: metadata ?? null,
      openedAt: new Date().toISOString(),
    };
  },
});

type ShowVaultListArgs = {
  reason?: string;
};

type ShowVaultListResult = {
  status: "vault_list_triggered";
  reason: string | null;
  openedAt: string;
};

const showVaultListTool = tool<ShowVaultListArgs, ShowVaultListResult>({
  description:
    "Display the list/history of vaults created by the user. Use this tool when the user wants to see the vault list, vault history, or a list of their vaults.",
  inputSchema: jsonSchema<ShowVaultListArgs>({
    type: "object",
    properties: {
      reason: {
        type: "string",
        description:
          "Short reason why vault list needs to be displayed (e.g., user wants to see vault history).",
      },
    },
    additionalProperties: false,
  }),
  execute: async ({ reason }: ShowVaultListArgs): Promise<ShowVaultListResult> => {
    return {
      status: "vault_list_triggered",
      reason: reason ?? null,
      openedAt: new Date().toISOString(),
    };
  },
});

type ShowVaultDetailArgs = {
  reason?: string;
  vaultId: string;
};

type ShowVaultDetailResult = {
  status: "vault_detail_triggered";
  reason: string | null;
  vaultId: string;
  openedAt: string;
};

const showVaultDetailTool = tool<ShowVaultDetailArgs, ShowVaultDetailResult>({
  description:
    "Display full details of a specific vault based on the Vault ID. Use this tool when the user mentions a specific Vault ID and wants to see its details.",
  inputSchema: jsonSchema<ShowVaultDetailArgs>({
    type: "object",
    properties: {
      reason: {
        type: "string",
        description:
          "Short reason why vault details need to be displayed.",
      },
      vaultId: {
        type: "string",
        description:
          "The Vault ID to view details for. Required.",
      },
    },
    required: ["vaultId"],
    additionalProperties: false,
  }),
  execute: async ({ reason, vaultId }: ShowVaultDetailArgs): Promise<ShowVaultDetailResult> => {
    return {
      status: "vault_detail_triggered",
      reason: reason ?? null,
      vaultId,
      openedAt: new Date().toISOString(),
    };
  },
});

export async function POST(req: Request) {
  const requestStartTime = Date.now();
  console.log("📨 POST request received at:", new Date().toISOString());

  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    console.log("💬 Number of messages:", messages.length, `(parse took ${Date.now() - requestStartTime}ms)`);

  // Get last user message for RAG
  // Handle content that can be string or array
  const userMessages = messages.filter(m => m.role === 'user');
  const lastUserMessageObj = userMessages.pop();
  
  console.log(`🔍 Debug RAG: Found ${userMessages.length + (lastUserMessageObj ? 1 : 0)} user messages`);
  
  let lastUserMessage = '';
  if (lastUserMessageObj) {
    // Log full structure for debugging
    console.log(`🔍 Debug RAG: Full message object keys:`, Object.keys(lastUserMessageObj));
    console.log(`🔍 Debug RAG: Full message object:`, JSON.stringify(lastUserMessageObj, null, 2));
    
    // Try various ways to extract content
    // Method 1: Direct content property (with type guard)
    let content: unknown = undefined;
    if ('content' in lastUserMessageObj) {
      content = (lastUserMessageObj as Record<string, unknown>).content;
    }
    
    // Method 2: Check parts property (some AI SDK formats use parts)
    if (!content && 'parts' in lastUserMessageObj && Array.isArray(lastUserMessageObj.parts)) {
      console.log(`🔍 Found 'parts' property with ${lastUserMessageObj.parts.length} items`);
      content = lastUserMessageObj.parts;
    }
    
    // Method 3: Check text property directly
    if (!content && 'text' in lastUserMessageObj) {
      console.log(`🔍 Found 'text' property directly`);
      content = lastUserMessageObj.text;
    }
    
    // Safe content preview for logging
    let contentPreview = 'N/A';
    try {
      if (typeof content === 'string') {
        contentPreview = content.substring(0, 50);
      } else if (content !== undefined && content !== null) {
        const stringified = JSON.stringify(content);
        contentPreview = stringified ? stringified.substring(0, 200) : 'empty string';
      }
    } catch (e) {
      contentPreview = `error parsing content: ${e}`;
    }
    
    console.log(`🔍 Debug RAG: Content extraction:`, {
      hasContent: !!content,
      contentType: typeof content,
      isArray: Array.isArray(content),
      contentPreview,
    });
    
    // Extract content with various methods
    if (content !== undefined && content !== null) {
      if (typeof content === 'string') {
        lastUserMessage = content;
        console.log(`✅ Extracted from string: "${lastUserMessage.substring(0, 50)}"`);
      } else if (Array.isArray(content)) {
        console.log(`🔍 Content is array with ${content.length} items`);
        // Extract text from content array
        const textParts = (content as unknown[])
          .filter((item: unknown) => {
            // Handle various content formats
            if (item && typeof item === 'object' && 'type' in item && item.type === 'text' && 'text' in item) return true;
            if (typeof item === 'string') return true;
            if (item && typeof item === 'object' && 'text' in item) return true;
            return false;
          })
          .map((item: unknown) => {
            if (item && typeof item === 'object' && 'type' in item && item.type === 'text' && 'text' in item) {
              return String((item as { text: unknown }).text);
            }
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'text' in item) {
              return String((item as { text: unknown }).text);
            }
            return '';
          });
        lastUserMessage = textParts.join(' ').trim();
        console.log(`✅ Extracted from array: "${lastUserMessage.substring(0, 50)}" (${textParts.length} parts)`);
      } else if (typeof content === 'object') {
        // Try to extract from object properties
        console.log(`🔍 Content is object, trying to extract...`);
        if ('text' in content) {
          lastUserMessage = String(content.text);
        } else {
          lastUserMessage = JSON.stringify(content);
        }
        console.log(`✅ Extracted from object: "${lastUserMessage.substring(0, 50)}"`);
      } else {
        // Fallback: convert to string
        lastUserMessage = String(content);
        console.log(`✅ Extracted via fallback: "${lastUserMessage.substring(0, 50)}"`);
      }
    } else {
      console.log(`⚠️ Content is ${content === undefined ? 'undefined' : 'null'}`);
      console.log(`🔍 Trying alternative extraction methods...`);
      
      // Last resort: try to extract from all properties
      const allKeys = Object.keys(lastUserMessageObj);
      console.log(`🔍 Available keys:`, allKeys);
      
      // Try to find text in various properties
      for (const key of allKeys) {
        const value = (lastUserMessageObj as unknown as Record<string, unknown>)[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          lastUserMessage = value;
          console.log(`✅ Found text in property '${key}': "${lastUserMessage.substring(0, 50)}"`);
          break;
        }
      }
    }
  }

  console.log(`🔍 Debug RAG: Extracted message: "${lastUserMessage.substring(0, Math.min(50, lastUserMessage.length))}" (length: ${lastUserMessage.length})`);

  // Get RAG context (optional, can be disabled if too slow)
  // Only call RAG if there's a valid query (minimum 3 characters)
  let ragContext = '';
  let ragQuality: unknown = undefined;
  const trimmedQuery = lastUserMessage.trim();
  const ragStartTime = Date.now();
  
  if (trimmedQuery.length >= 3) {
    console.log(`✅ Calling RAG with query: "${trimmedQuery.substring(0, 50)}..."`);
    const ragResult = await getRAGContext(trimmedQuery);
    ragContext = ragResult.context;
    ragQuality = ragResult.quality;
    console.log(`⏱️ RAG completed in ${Date.now() - ragStartTime}ms`);
    if (ragContext) {
      console.log("📚 RAG context loaded:", ragContext.substring(0, 100) + '...');
    }
  } else if (trimmedQuery.length > 0 && trimmedQuery.length < 3) {
    console.log(`ℹ️ Skipping RAG: query too short (< 3 chars): "${trimmedQuery}"`);
  } else if (!trimmedQuery) {
    console.log("ℹ️ Skipping RAG: no user message found");
    console.log("🔍 Debug: lastUserMessageObj =", lastUserMessageObj ? 'exists' : 'null');
    console.log("🔍 Debug: lastUserMessage =", `"${lastUserMessage}"`);
  }

  console.log(`⏱️ Pre-AI setup took ${Date.now() - requestStartTime}ms`);

  let tools: Record<string, unknown> = {};

  try {
    // Add timeout for MCP tools to prevent hanging
    const MCP_TIMEOUT_MS = 15000; // 15 seconds
    const mcpStartTime = Date.now();
    const mcpToolsPromise = getMCPTools();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('MCP tools fetch timeout')), MCP_TIMEOUT_MS);
    });
    
    tools = await Promise.race([mcpToolsPromise, timeoutPromise]);
    console.log(`🔧 Available tools: ${Object.keys(tools).length} (MCP took ${Date.now() - mcpStartTime}ms)`);
  } catch (error) {
    console.error("❌ Failed to fetch MCP tools:", error);
    console.log("⚠️ Continuing without MCP tools...");
  }

  // Filter out search_service_information to prevent "Service Info" cards
  const filteredTools = { ...tools } as Record<string, unknown>;
  delete (filteredTools as Record<string, unknown>)["search_service_information"];

  const combinedTools = {
    ...filteredTools,
    open_vault_wizard: openVaultWizardTool,
    open_vault_claim_wizard: openVaultClaimWizardTool,
    open_vault_edit_wizard: openVaultEditWizardTool,
    estimate_arweave_cost: estimateArweaveCostTool,
    show_vault_list: showVaultListTool,
    show_vault_detail: showVaultDetailTool,
  };

  // Augment system prompt with RAG context
  const systemPromptParts = [
    `You are an AI assistant for a Digital Legacy Vault platform called Inheritance.`,
    `Your primary language is English.`,
    "",
    "If the user speaks in English, reply in English.",
    "",
    ragContext ? "Context from documentation and user's vault:\n" + ragContext : "",
    "",
    "IMPORTANT: You strictly ONLY answer questions related to the Inheritance project/platform.",
    "If the user asks about potential competitors, other companies, general knowledge, or anything not directly related to the Inheritance platform, explicitly REFUSE to answer. Say something like 'I can only assist with questions regarding the Inheritance platform.'",
    "",
    "If the user needs to create or continue filling out a vault, call the `open_vault_wizard` tool with a brief explanation.",
    "",
    "If the user wants to open, unlock, or claim a vault (e.g., typing: 'open vault', 'unlock vault', 'claim inheritance', 'open vault'), call the `open_vault_claim_wizard` tool with an appropriate reason.",
    "",
    "If the user mentions wanting to change/edit an existing vault (e.g., 'edit vault', 'update vault content', 'update vault'), call the `open_vault_edit_wizard` tool and explain that they need to provide the Vault ID, security question answers, 3 fraction keys, and the vault content.",
    "",
    "If the user wants to calculate costs, call the `estimate_arweave_cost` tool.",
    "",
    "If the user wants to see the list/history of created vaults (e.g., 'view vault history', 'list my vaults', 'vault list'), call the `show_vault_list` tool.",
    "",
    "If the user mentions a specific Vault ID and wants to see its details (e.g., 'view details for vault abc123', 'show vault XYZ'), call the `show_vault_detail` tool with the vaultId parameter.",
    "",
    "When opening or editing a vault, the primary authentication priority is the combination of Vault ID, security questions, and fraction keys"
  ].filter(line => line.length > 0);

  console.log(`⏱️ Total setup time: ${Date.now() - requestStartTime}ms, ready to call DeepSeek AI...`);

  const aiStartTime = Date.now();
  let firstChunkLogged = false;
  
  const result = streamText({
    model: deepseek("deepseek-chat"),
    messages: convertToModelMessages(messages),
    tools: combinedTools,
    system: systemPromptParts.join("\n"),
    onError: (error) => {
      console.error("❌ Error in streamText:", error);
    },
    onChunk: ({ chunk }) => {
      // Log first chunk to confirm streaming started
      if (chunk.type === 'text-delta' && !firstChunkLogged) {
        console.log(`✨ First AI chunk received in ${Date.now() - aiStartTime}ms`);
        firstChunkLogged = true;
      }
    },
    onFinish: async (result) => {
      console.log("✅ StreamText completed");
      console.log(
        "🛠️ Tools used:",
        result.toolCalls?.map((tc) => tc.toolName) || "None",
      );
      
      // Log quality metrics to backend
      try {
        const responseTime = Date.now() - aiStartTime;
        const ragResponseTime = ragStartTime ? Date.now() - ragStartTime : undefined;
        
        // Extract full response text from result
        const responseText = result.text || '';
        
        // Detect uncertainty phrases
        const uncertaintyPhrases = [
          "I'm not sure",
          "I don't know",
          "not sure",
          "maybe",
          "possibly",
          "might be",
          "could be",
          "haven't found",
          "no information",
          "sorry, no",
          "yet to find",
          "couldn't find",
          "not available",
          "no data",
          "insufficient information",
          "limited information",
        ];
        
        const responseLower = responseText.toLowerCase();
        const foundUncertaintyPhrases = uncertaintyPhrases.filter(phrase => 
          responseLower.includes(phrase)
        );
        
        // Calculate confidence from RAG quality or from uncertainty
        let confidence: 'high' | 'medium' | 'low' = 'medium';
        if (ragQuality && typeof ragQuality === 'object' && 'confidence' in ragQuality) {
          confidence = ragQuality.confidence as 'high' | 'medium' | 'low';
        } else if (foundUncertaintyPhrases.length > 0 || !ragContext) {
          confidence = 'low';
        } else if (ragContext && responseText.length > 100) {
          confidence = 'high';
        }
        
        // Prepare quality metrics
        const qualityMetrics = {
          timestamp: new Date().toISOString(),
          query: trimmedQuery.substring(0, 500), // Limit query length
          hasRAGContext: !!ragContext,
          sourceCount: (ragQuality && typeof ragQuality === 'object' && 'sourceCount' in ragQuality) 
            ? (ragQuality.sourceCount as number) 
            : (ragContext ? 1 : 0),
          avgRelevanceScore: (ragQuality && typeof ragQuality === 'object' && 'avgRelevanceScore' in ragQuality)
            ? (ragQuality.avgRelevanceScore as number)
            : 0,
          maxRelevanceScore: (ragQuality && typeof ragQuality === 'object' && 'maxRelevanceScore' in ragQuality)
            ? (ragQuality.maxRelevanceScore as number)
            : 0,
          minRelevanceScore: (ragQuality && typeof ragQuality === 'object' && 'minRelevanceScore' in ragQuality)
            ? (ragQuality.minRelevanceScore as number)
            : 0,
          confidence,
          responseLength: responseText.length,
          hasUncertaintyPhrases: foundUncertaintyPhrases.length > 0,
          uncertaintyPhrases: foundUncertaintyPhrases.length > 0 ? foundUncertaintyPhrases : undefined,
          toolCalls: result.toolCalls?.map((tc) => tc.toolName),
          responseTime,
          ragResponseTime,
        };
        
        // Send to backend logging endpoint
        const backendUrl = process.env.BACKEND_BASE_URL || 'http://localhost:7002';
        const logUrl = `${backendUrl}/api/v1/ai-quality/log`;
        
        fetch(logUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(qualityMetrics),
        }).catch((err) => {
          console.warn('⚠️ Failed to log quality metrics:', err);
        });
      } catch (error) {
        console.warn('⚠️ Error logging quality metrics:', error);
      }
    },
  });

  console.log("🚀 Returning response stream...");
  return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("❌ Unhandled error in POST /api/chat:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
