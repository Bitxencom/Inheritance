/**
 * Centralized blockchain configurations and utilities for the bitxen-inheritance project.
 */

export type ChainId =
  | 'bscTestnet'
  | 'bsc'
  | 'eth'
  | 'polygon'
  | 'base'
  | 'arbitrum'
  | 'optimism'
  | 'linea'
  | 'sei'
  | 'avalanche'
  | 'monad';

export interface ChainInfo {
  chainId: number;
  chainIdHex: string;
  name: string;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls?: string[];
  rpcUrl: string;
  blockExplorer: string;
  contractAddress: string;
  governorAddress?: string;
  logo: string;
  isTestnet: boolean;
}

export const CHAIN_CONFIG: Record<ChainId, ChainInfo> = {
  bscTestnet: {
    chainId: 97,
    chainIdHex: "0x61",
    name: "BNB Smart Chain Testnet",
    shortName: "BSC Testnet",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    rpcUrls: [
      "https://bsc-testnet-dataseed.bnbchain.org/",
      "https://bsc-testnet.publicnode.com/",
      "https://data-seed-prebsc-1-s2.binance.org:8545/",
      "https://data-seed-prebsc-2-s1.binance.org:8545/",
      "https://data-seed-prebsc-1-s1.binance.org:8545/",
      "https://data-seed-prebsc-2-s1.binance.org:8545/",
      "https://bsc-testnet-rpc.publicnode.com/"
    ],
    rpcUrl: "https://data-seed-prebsc-2-s1.bnbchain.org:8545/",
    blockExplorer: "https://testnet.bscscan.com",
    contractAddress: "0xeFe3D5d233Df4764826Cba9edfF8c0032E78e06C",
    governorAddress: "0x8F94e79c07ff47E16C316B5b184B72C8109AaEAC",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png",
    isTestnet: true,
  },
  bsc: {
    chainId: 56,
    chainIdHex: "0x38",
    name: "BNB Smart Chain",
    shortName: "BSC",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: [
      "https://bsc-dataseed.binance.org/",
      "https://bsc-dataseed1.defibit.io/",
      "https://bsc-dataseed1.ninicoin.io/",
      "https://bsc-dataseed2.defibit.io/",
      "https://bsc-dataseed3.defibit.io/",
      "https://bsc-dataseed4.defibit.io/",
      "https://bsc-dataseed1.binance.org/",
      "https://bsc-dataseed2.binance.org/",
      "https://bsc-dataseed3.binance.org/",
      "https://bsc-dataseed4.binance.org/"
    ],
    rpcUrl: "https://bsc-dataseed.binance.org/",
    blockExplorer: "https://bscscan.com",
    contractAddress: "0xfCE73A806c3B1400a7672049D56e16E5b9bfFA2A",
    governorAddress: "0x6dd2E9B49ECBcC5b556da44D812C857Bf2a068bB",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png",
    isTestnet: false,
  },
  eth: {
    chainId: 1,
    chainIdHex: "0x1",
    name: "Ethereum Mainnet",
    shortName: "ETH",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://eth.llamarpc.com",
    blockExplorer: "https://etherscan.io",
    contractAddress: "0xa5e79731386f70ac4165cd9beb63a4876097ad8a",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    isTestnet: false,
  },
  polygon: {
    chainId: 137,
    chainIdHex: "0x89",
    name: "Polygon Mainnet",
    shortName: "POLY",
    nativeCurrency: { name: "Matic", symbol: "MATIC", decimals: 18 },
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    contractAddress: "0x8c7D96de6a5E7734E9E300e0F4D6C02e348ddf31",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
    isTestnet: false,
  },
  base: {
    chainId: 8453,
    chainIdHex: "0x2105",
    name: "Base Mainnet",
    shortName: "BASE",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
    isTestnet: false,
  },
  arbitrum: {
    chainId: 42161,
    chainIdHex: "0xa4b1",
    name: "Arbitrum One",
    shortName: "ARB",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
    isTestnet: false,
  },
  optimism: {
    chainId: 10,
    chainIdHex: "0xa",
    name: "Optimism",
    shortName: "OP",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://mainnet.optimism.io",
    blockExplorer: "https://optimistic.etherscan.io",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
    isTestnet: false,
  },
  linea: {
    chainId: 59144,
    chainIdHex: "0xe708",
    name: "Linea",
    shortName: "LINEA",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://rpc.linea.build",
    blockExplorer: "https://lineascan.build",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png",
    isTestnet: false,
  },
  sei: {
    chainId: 1329,
    chainIdHex: "0x531",
    name: "Sei EVM",
    shortName: "SEI",
    nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 },
    rpcUrl: "https://evm-rpc.sei-apis.com",
    blockExplorer: "https://seitrace.com",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/sei/info/logo.png",
    isTestnet: false,
  },
  avalanche: {
    chainId: 43114,
    chainIdHex: "0xa86a",
    name: "Avalanche C-Chain",
    shortName: "AVAX",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    blockExplorer: "https://snowtrace.io",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
    isTestnet: false,
  },
  monad: {
    chainId: 10143,
    chainIdHex: "0x279f",
    name: "Monad Testnet",
    shortName: "MONAD",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    rpcUrl: "https://testnet-rpc.monad.xyz",
    blockExplorer: "https://testnet.monadexplorer.com",
    contractAddress: "0xE6311C46841d6953D3EBc035CDdCC2f10C9d821c",
    logo: "",
    isTestnet: true,
  },
};

/**
 * Returns a list of all supported chain keys.
 */
export function getAvailableChains(): ChainId[] {
  return Object.keys(CHAIN_CONFIG) as ChainId[];
}

/**
 * Normalizes a numeric chain ID to a supported ChainId key.
 */
export function getChainKeyFromNumericChainId(numericId: number): ChainId | null {
  const chains = getAvailableChains();
  for (const key of chains) {
    if (CHAIN_CONFIG[key].chainId === numericId) {
      return key;
    }
  }
  return null;
}

/**
 * Gets the numeric network ID for a given chain key.
 */
export function getNetworkIdFromChainKey(chainKey: ChainId): number {
  return CHAIN_CONFIG[chainKey]?.chainId || 1;
}

export const DEFAULT_CHAIN: ChainId = (process.env.NEXT_PUBLIC_DEFAULT_CHAIN as ChainId) || process.env.NODE_ENV === "production" ? "bsc" : "bscTestnet";

export function getChainConfig(chain: ChainId): ChainInfo {
  return CHAIN_CONFIG[chain] || CHAIN_CONFIG[DEFAULT_CHAIN];
}

