#!/usr/bin/env node

import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools
import { digitalInheritanceTools } from './tools/digital-inheritance-tools.js';
import { documentationSearchTool, vaultSearchTool } from './tools/rag-tools.js';
import { searchDocumentation, searchVaults, combinedSearch } from './services/rag-retrieval.js';

const isDevelopmentEnv = process.env.NODE_ENV !== 'production';

// Backend configuration
// Use BACKEND_BASE_URL from environment, fallback to Docker internal hostname
const backendBaseUrl =
  process.env.BACKEND_BASE_URL?.replace(/\/$/, '') ||
  'http://backend:7002';

console.log(`🔧 MCP Server backend config: ${backendBaseUrl}`);

const generateVaultId = () => {
  return randomUUID();
};

/**
 * Forward vault creation request to backend
 */
async function forwardToBackend(payload) {
  try {
    const response = await fetch(`${backendBaseUrl}/api/v1/vaults`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle validation errors with more detail
      if (response.status === 400 && data.details) {
        const validationErrors = Array.isArray(data.details)
          ? data.details.map(err => `${err.path}: ${err.message}`).join(', ')
          : 'Validation error';
        throw new Error(`Validation error: ${validationErrors}`);
      }

      // Handle other errors
      const errorMessage = typeof data?.error === 'string'
        ? data.error
        : data?.message || 'Backend returned an error status.';
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error('❌ Backend vault service failed:', error.message || error);
    throw error;
  }
}

class DigitalInheritanceAIServer {
  constructor() {
    this.server = new Server(
      {
        name: 'digital-inheritance-ai-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          ...digitalInheritanceTools,
          documentationSearchTool,
          vaultSearchTool,
        ],
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Route to appropriate tool handler
        switch (name) {
          // Digital Inheritance tools
          case 'create_vault_draft':
            return await this.handleCreateDigitalWillDraft(args);
          case 'delete_vault_asset':
            return await this.handleDeleteDigitalWillAsset(args);
          case 'view_all_vault_assets':
            return await this.handleViewAllDigitalWillAssets(args);
          case 'search_vault_assets':
            return await this.handleSearchDigitalWillAssets(args);
          case 'update_vault_asset':
            return await this.handleUpdateDigitalWillAsset(args);
          case 'generate_vault_document':
            return await this.handleGenerateDigitalWillDocument(args);
          case 'vault_creation_wizard':
            return await this.handleVaultCreationWizard(args);
          case 'vault_claim_wizard':
            return await this.handleVaultClaimWizard(args);

          // RAG tools
          case 'search_service_information':
            return await this.handleSearchServiceInformation(args);
          case 'search_will_vaults':
            return await this.handleSearchWillVaults(args);

          default:
            throw new Error(`Tool not found: ${name}`);
        }
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  // Digital Inheritance tool handlers
  async handleCreateDigitalWillDraft(args) {
    const {
      item,
      category,
      beneficiary,
      value = '',
      access_info = '',
      priority = 'medium',
      notes = '',
      is_conditional = false,
      conditions = ''
    } = args;

    // Simulate data storage (in real implementation, this would go to database)
    const digitalInheritanceAsset = {
      id: Date.now().toString(),
      item,
      category,
      beneficiary,
      value,
      access_info,
      priority,
      notes,
      is_conditional,
      conditions,
      createdAt: new Date().toISOString(),
    };

    console.log('📝 Adding asset to vault:', digitalInheritanceAsset);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Asset "${item}" successfully added to vault with category "${category}" for beneficiary "${beneficiary}" and priority "${priority}".`,
        },
      ],
    };
  }

  async handleDeleteDigitalWillAsset(args) {
    const { assetId } = args;

    console.log('🗑️ Removing asset from vault:', assetId);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Asset with ID "${assetId}" successfully removed from vault.`,
        },
      ],
    };
  }

  async handleViewAllDigitalWillAssets(args) {
    const { category = null, priority = null, beneficiary = null } = args;

    // TODO: In real implementation, this would fetch from the backend/storage
    // For now, we return a message that view all is being integrated with the real vault

    return {
      content: [
        {
          type: 'text',
          text: `📋 Digital Will Assets:\n\nFeature currently being integrated with your real vault ID. Please check your vault on the Arweave explorer for the most up-to-date information.`,
        },
      ],
    };
  }

  async handleSearchDigitalWillAssets(args) {
    const { query } = args;

    console.log('🔍 Searching in vault:', query);

    // Simulate search (in real implementation, this would query database)
    const mockResults = [
      {
        id: '1',
        item: 'House in South Jakarta',
        category: 'property',
        beneficiary: 'First Child',
        priority: 'critical',
        notes: 'Main family residence',
        relevanceScore: 0.9,
      },
    ];

    const resultsText = mockResults.map(aset =>
      `• ${aset.item} (${aset.category})\n  Beneficiary: ${aset.beneficiary}\n  Priority: ${aset.priority}\n  Notes: ${aset.notes}`
    ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `🔍 Search results for "${query}":\n\n${resultsText || 'No matching assets found.'}`,
        },
      ],
    };
  }

  async handleUpdateDigitalWillAsset(args) {
    const { assetId, updates } = args;

    console.log('✏️ Updating asset in vault:', assetId, updates);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Asset with ID "${assetId}" successfully updated in vault.`,
        },
      ],
    };
  }

  async handleGenerateDigitalWillDocument(args) {
    const { format = 'pdf', include_signature = true, template_type = 'formal' } = args;

    console.log('📄 Creating vault document:', { format, include_signature, template_type });

    return {
      content: [
        {
          type: 'text',
          text: `📄 Vault document successfully created in ${format.toUpperCase()} format with ${template_type} template${include_signature ? ' and digital signature area' : ''}.`,
        },
      ],
    };
  }

  async handleVaultCreationWizard(args = {}) {
    // Forward to backend
    try {
      const backendResult = await forwardToBackend(args);

      // Backend succeeded, return result from backend
      const vaultId = backendResult.details?.vaultId || generateVaultId();
      const summary = {
        vaultId,
        environment: isDevelopmentEnv ? 'development' : 'production',
        isPqcEnabled,
        title: args.willDetails?.title || '',
        willType: args.willDetails?.willType || '',
        beneficiaries: backendResult.details?.shares?.map((share) => ({
          fullName: share.beneficiary?.fullName || '',
          relationship: share.beneficiary?.relationship || '',
          share: share.share || '',
        })) || [],
        trigger: args.triggerRelease || {},
        paymentMethod: args.payment?.paymentMethod || '',
        arweaveTxId: backendResult.details?.arweaveTxId ?? null,
        rawShares: backendResult.details?.rawShares ?? null,
        pqcPublicKey: backendResult.details?.pqcKeyPair?.publicKey ?? null,
      };

      console.log('✅ Vault successfully created via backend:', {
        vaultId,
        arweaveTxId: summary.arweaveTxId,
        isPqcEnabled,
      });

      const pqcNote = isPqcEnabled ? ' with Post-Quantum encryption (ML-KEM-768)' : '';
      const baseSuccessText = `✅ Vault ${vaultId} successfully created and encrypted${pqcNote}.`;

      return {
        content: [
          {
            type: 'text',
            text: baseSuccessText,
          },
          {
            type: 'text',
            text: JSON.stringify({
              ...summary,
              message: backendResult.message || 'Vault is now secured and scheduled for release according to your instructions.',
            }),
          },
        ],
      };
    } catch (error) {
      console.error('❌ Backend vault service failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to create vault: ${error.message}. Please check if the backend service is running.`,
        }],
      };
    }
  }

  async handleVaultClaimWizard(args = {}) {
    const { vaultId, arweaveTxId, fractionKeys = [], securityAnswers = [], beneficiaryEmail } = args;

    console.log('🔓 Processing vault claim:', { vaultId, beneficiaryEmail, fractionKeyCount: fractionKeys.length });

    // Validasi input
    if (!vaultId) {
      return {
        content: [{
          type: 'text',
          text: '❌ Vault ID is required for claim.',
        }],
      };
    }

    if (fractionKeys.length < 3) {
      return {
        content: [{
          type: 'text',
          text: `❌ Please provide at least 3 Fraction Keys to unlock the vault. You currently have ${fractionKeys.length}.`,
        }],
      };
    }

    if (securityAnswers.length < 3) {
      return {
        content: [{
          type: 'text',
          text: `❌ Please answer at least 3 security questions to verify your identity.`,
        }],
      };
    }

    // Forward to backend for claim
    try {
      const response = await fetch(`${backendBaseUrl}/api/v1/vaults/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vaultId,
          arweaveTxId,
          fractionKeys,
          securityAnswers,
          beneficiaryEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.message || 'Vault claim failed';
        throw new Error(errorMessage);
      }

      // Claim successful
      const isPqcEnabled = data.details?.isPqcEnabled || false;
      const pqcNote = isPqcEnabled ? ' (with Post-Quantum decryption)' : '';

      console.log('✅ Vault successfully claimed:', { vaultId, isPqcEnabled });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Vault ${vaultId} successfully claimed${pqcNote}!`,
          },
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              vaultId,
              isPqcEnabled,
              decryptedData: data.details?.decryptedData || null,
              message: data.message || 'Identity verified. Vault unlocked successfully.',
            }),
          },
        ],
      };
    } catch (error) {
      console.error('❌ Vault claim failed:', error.message);
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to claim vault: ${error.message}`,
        }],
      };
    }
  }

  // RAG tool handlers
  async handleSearchServiceInformation(args) {
    const { query } = args;

    console.log(`🔍 Searching documentation for: "${query}"`);

    try {
      const results = await searchDocumentation(query, 3);

      if (!results || results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `Sorry, could not find information about "${query}" in our service documentation. Please try with different keywords or contact support.`,
          }],
        };
      }

      // Format results - separate content from sources
      const formattedResults = results.map((r) => {
        const fileName = r.file || r.source || 'Documentation';
        const content = r.content || '';
        return {
          file: fileName,
          content: content,
        };
      });

      // Combine content with neater format
      const contentText = formattedResults
        .map((r) => r.content)
        .join('\n\n---\n\n');

      // Save sources as metadata (will be extracted in frontend)
      const sources = formattedResults.map((r) => r.file);
      const uniqueSources = [...new Set(sources)];

      // Format response with metadata at the end (JSON format that can be parsed)
      // Frontend will extract this metadata
      const responseText = `${contentText}\n\n<!-- RAG_METADATA:${JSON.stringify({ sources: uniqueSources, query })} -->`;

      console.log(`✅ Found ${results.length} results, returning response`);

      return {
        content: [{
          type: 'text',
          text: responseText,
        }],
      };

      return {
        content: [{
          type: 'text',
          text: responseText,
        }],
      };
    } catch (error) {
      console.error('❌ Error in handleSearchServiceInformation:', error);
      const errorMessage = error.message || 'Unknown error';
      console.error('Error stack:', error.stack);

      // Return helpful error message
      return {
        content: [{
          type: 'text',
          text: `Sorry, an error occurred while searching for information about "${query}".\n\n` +
            `Error: ${errorMessage}\n\n` +
            `Make sure the backend RAG service is running and accessible at:\n` +
            `${backendBaseUrl}/api/v1/rag/documentation/search\n\n` +
            `Please try again or contact support if the problem persists.`,
        }],
      };
    }
  }

  async handleSearchWillVaults(args) {
    const { query, vaultIds } = args;

    console.log(`🔍 Searching vaults for: "${query}"`);

    // TODO: Get vaultIds from user session if not provided
    // For now, if there are no vaultIds, return error
    if (!vaultIds || vaultIds.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'To search for vaults, I need your vault ID list. Please provide the vault ID or use the "view all vaults" feature first.',
        }],
      };
    }

    // Search vaults (without fraction keys for now, metadata only)
    const results = await searchVaults(query, vaultIds, null, 5);

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No vault found matching "${query}".`,
        }],
      };
    }

    // Format results
    const context = results.map((r, i) =>
      `[Vault ${i + 1}: ${r.title}]\n${r.content}${r.canDecrypt ? '' : '\n*Encrypted content - need fraction keys to view full details*'}`
    ).join('\n\n---\n\n');

    return {
      content: [{
        type: 'text',
        text: `Found ${results.length} relevant vaults:\n\n${context}`,
      }],
    };
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      try {
        await this.server.close();
        console.log('✅ Server closed successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log('🚀 Vault AI MCP Server running...');

      // Keep process alive - stdio transport will handle input/output
      // Process will keep running until it receives SIGINT/SIGTERM
      // If stdin is not available (background mode), still keep process alive
      if (process.stdin.isTTY) {
        process.stdin.resume();
      } else {
        // Background mode: keep process alive with interval check
        setInterval(() => {
          // Keep process alive
        }, 60000); // Check every 60 seconds
      }
    } catch (error) {
      console.error('❌ Error starting MCP server:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new DigitalInheritanceAIServer();
server.run().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
