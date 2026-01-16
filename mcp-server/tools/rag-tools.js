export const documentationSearchTool = {
  name: 'search_service_information',
  description: 'Search for information about vault services from company documentation. Use this tool when user asks about features, usage instructions, FAQ, or general information about the service.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Question or keyword about services, features, or company information',
      },
    },
    required: ['query'],
  },
};

export const vaultSearchTool = {
  name: 'search_will_vaults',
  description: 'Search user\'s will vaults by query. Use this tool when user asks about their will vaults, such as "my will document about property" or "who is the beneficiary of my crypto assets".',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for will vaults (example: "property", "crypto", "first child")',
      },
      vaultIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of vault IDs to search (optional, if not provided will search all)',
      },
    },
    required: ['query'],
  },
};

