// Digital Inheritance Tools for MCP Server
export const digitalInheritanceTools = [
  {
    name: 'create_vault_draft',
    description: 'Add a new asset to the vault',
    inputSchema: {
      type: 'object',
      properties: {
        item: {
          type: 'string',
          description: 'Name of the asset to add to the will',
        },
        category: {
          type: 'string',
          enum: [
            'digital_will', 'credentials_and_secrets'
          ],
          description: 'Asset category according to vault definition',
        },
        beneficiary: {
          type: 'string',
          description: 'Name of the beneficiary',
        },
        value: {
          type: 'string',
          description: 'Estimated value of the asset (optional)',
          default: '',
        },
        access_info: {
          type: 'string',
          description: 'Access information (username, password, keys, etc)',
          default: '',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Asset priority in the will',
          default: 'medium',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the asset and special instructions',
          default: '',
        },
        is_conditional: {
          type: 'boolean',
          description: 'Whether the asset has special conditions for the beneficiary',
          default: false,
        },
        conditions: {
          type: 'string',
          description: 'Special conditions for the beneficiary (if is_conditional = true)',
          default: '',
        },
      },
      required: ['item', 'category', 'beneficiary'],
    },
  },
  {
    name: 'delete_vault_asset',
    description: 'Remove an asset from the vault by ID',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'string',
          description: 'ID of the asset to remove from the will',
        },
      },
      required: ['assetId'],
    },
  },
  {
    name: 'view_all_vault_assets',
    description: 'Get list of all assets in the vault with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by asset category (optional)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Filter by asset priority (optional)',
        },
        beneficiary: {
          type: 'string',
          description: 'Filter by beneficiary name (optional)',
        },
      },
    },
  },
  {
    name: 'search_vault_assets',
    description: 'Search assets in the vault by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keyword to search assets in the will',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_vault_asset',
    description: 'Update information of an existing asset in the vault',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'string',
          description: 'ID of the asset to update',
        },
        updates: {
          type: 'object',
          description: 'Object containing fields to update',
          properties: {
            item: { type: 'string' },
            beneficiary: { type: 'string' },
            value: { type: 'string' },
            access_info: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            notes: { type: 'string' },
            is_conditional: { type: 'boolean' },
            conditions: { type: 'string' },
          },
        },
      },
      required: ['assetId', 'updates'],
    },
  },
  {
    name: 'generate_vault_document',
    description: 'Create vault document in PDF or official document format',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['pdf', 'docx', 'html'],
          description: 'Output format of the will document',
          default: 'pdf',
        },
        include_signature: {
          type: 'boolean',
          description: 'Whether to include digital signature area',
          default: true,
        },
        template_type: {
          type: 'string',
          enum: ['formal', 'simple', 'detailed'],
          description: 'Type of will template',
          default: 'formal',
        },
      },
    },
  },
  {
    name: 'vault_creation_wizard',
    description: 'Receive complete VaultCreationWizard data to create a vault vault. Supports hybrid encryption (AES-256 + ML-KEM) for quantum protection if enablePqc is enabled.',
    inputSchema: {
      type: 'object',
      properties: {
        willDetails: {
          type: 'object',
          properties: {
            willType: {
              type: 'string',
              enum: ['one-time', 'editable'],
            },
            title: {
              type: 'string',
            },
            content: {
              type: 'string',
            },
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  size: { type: 'number' },
                  type: { type: 'string' },
                },
              },
            },
          },
          required: ['willType', 'title', 'content'],
        },
        securityQuestions: {
          type: 'array',
          minItems: 3,
          maxItems: 5,
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
            },
            required: ['question', 'answer'],
          },
        },
        beneficiaries: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          items: {
            type: 'object',
            properties: {
              fullName: { type: 'string' },
              email: { type: 'string' },
              dateOfBirth: { type: 'string' },
              relationship: {
                type: 'string',
                enum: ['spouse', 'child', 'parent', 'sibling', 'grandchild', 'friend', 'other'],
              },
            },
            required: ['fullName', 'email', 'dateOfBirth', 'relationship'],
          },
        },
        triggerRelease: {
          type: 'object',
          properties: {
            triggerType: {
              type: 'string',
              enum: ['date', 'death'],
            },
            triggerDate: {
              type: 'string',
            },
          },
          required: ['triggerType', 'triggerDate'],
        },
        payment: {
          type: 'object',
          properties: {
            paymentMethod: {
              type: 'string',
              enum: ['wander'],
              description: 'Payment method: wander (Wander Wallet/AR)',
            },
          },
          required: ['paymentMethod'],
        },
        enablePqc: {
          type: 'boolean',
          description: 'Enable Post-Quantum encryption (ML-KEM-768 + AES-256) for protection from quantum computer threats. Default: true',
          default: true,
        },
      },
      required: ['willDetails', 'securityQuestions', 'beneficiaries', 'triggerRelease', 'payment'],
    },
  },
  {
    name: 'vault_claim_wizard',
    description: 'Claim and unlock a digital vault using Fraction Keys and security questions. Supports vault decryption with PQC hybrid encryption.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultId: {
          type: 'string',
          description: 'ID of the vault to claim',
        },
        arweaveTxId: {
          type: 'string',
          description: 'Arweave Transaction ID of the vault',
        },
        fractionKeys: {
          type: 'array',
          minItems: 3,
          items: {
            type: 'string',
          },
          description: 'Fraction Keys needed to reconstruct the decryption key (minimum 3 of 5)',
        },
        securityAnswers: {
          type: 'array',
          minItems: 3,
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
            },
            required: ['question', 'answer'],
          },
          description: 'Security question answers for verification',
        },
        beneficiaryEmail: {
          type: 'string',
          description: 'Email of the beneficiary claiming the vault',
        },
      },
      required: ['vaultId', 'fractionKeys', 'securityAnswers', 'beneficiaryEmail'],
    },
  },
];
