#!/usr/bin/env npx tsx

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

// --- MINIMAL ABI ENCODER/DECODER ---
function encodeBytes32(hex: string): string {
    const clean = hex.replace(/^0x/i, '').toLowerCase();
    return clean.padStart(64, '0');
}

// getDataRecord(bytes32) -> 0x470878a2
const GET_DATA_RECORD_SELECTOR = '470878a2';
// getVaultSecret(bytes32) -> 0x2289c09d 
const GET_VAULT_SECRET_SELECTOR = '2289c09d';

// --- CHAIN CONFIG (Copied from lib/chains.ts) ---
const CHAIN_CONFIG: Record<string, any> = {
    bscTestnet: {
        chainId: 97,
        name: "BNB Smart Chain Testnet",
        rpcUrl: "https://data-seed-prebsc-1-s1.bnbchain.org:8545/",
        contractAddress: "0xeFe3D5d233Df4764826Cba9edfF8c0032E78e06C",
    },
    bsc: {
        chainId: 56,
        name: "BNB Smart Chain",
        rpcUrl: "https://bsc-dataseed.binance.org/",
        contractAddress: "0xfCE73A806c3B1400a7672049D56e16E5b9bfFA2A",
    },
    polygon: {
        chainId: 137,
        name: "Polygon Mainnet",
        rpcUrl: "https://polygon-rpc.com",
        contractAddress: "0x8c7D96de6a5E7734E9E300e0F4D6C02e348ddf31",
    }
};

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
    const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [{ to, data }, "latest"],
        }),
    });
    const json: any = await response.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
}

// Simple decoder for the Bitxen DataRecord struct (New Version)
function decodeDataRecord(hex: string) {
    const data = hex.replace(/^0x/, '');
    // Offset-based decoding for a complex struct is hard without a full library,
    // but we can extract fixed-size fields easily.
    // Struct layout: owner(20b), hash(32b), uri(offset), provider(32b), created(32b), ...

    const getChunk = (index: number) => data.substring(index * 64, (index + 1) * 64);

    return {
        owner: '0x' + getChunk(0).substring(24),
        currentDataHash: '0x' + getChunk(1),
        // Strings are dynamic, skipping complex parsing for CLI
        provider: '0x' + getChunk(3),
        createdAt: parseInt(getChunk(4), 16),
        lastUpdatedAt: parseInt(getChunk(5), 16),
        fileSize: parseInt(getChunk(7), 16),
        isPermanent: parseInt(getChunk(10), 16) === 1,
        currentVersion: parseInt(getChunk(11), 16),
        releaseDate: parseInt(getChunk(14), 16),
        isReleased: parseInt(getChunk(15), 16) === 1,
        releaseEntropy: '0x' + getChunk(16),
    };
}

program
    .name('bitxen-checker')
    .description('Check vault status on Bitxen blockchain')
    .requiredOption('-c, --chain <key>', 'Chain key (bsc, bscTestnet, polygon)')
    .requiredOption('-d, --data-id <id>', 'Bitxen Contract Data ID (bytes32)')
    .option('-a, --address <addr>', 'Override contract address')
    .action(async (options) => {
        const { chain: chainKey, dataId, address: addrOverride } = options;
        const config = CHAIN_CONFIG[chainKey];

        if (!config) {
            console.log(chalk.red(`❌ Unknown chain: ${chainKey}`));
            console.log(`Available: ${Object.keys(CHAIN_CONFIG).join(', ')}`);
            return;
        }

        const contractAddress = addrOverride || config.contractAddress;
        console.log(chalk.blue.bold(`\n⛓️  Bitxen Blockchain Checker`));
        console.log(`Chain:    ${chalk.cyan(config.name)}`);
        console.log(`Contract: ${chalk.cyan(contractAddress)}`);
        console.log(`Data ID:  ${chalk.yellow(dataId)}`);

        try {
            console.log(chalk.gray('\nFetching Data Record...'));
            const callData = '0x' + GET_DATA_RECORD_SELECTOR + encodeBytes32(dataId);
            const result = await ethCall(config.rpcUrl, contractAddress, callData);

            if (result === '0x' || result === '0x' + '0'.repeat(64)) {
                console.log(chalk.red('❌ Data record not found on this chain.'));
                return;
            }

            const record = decodeDataRecord(result);

            console.log(chalk.white.bold('\n--- On-Chain Status ---'));
            console.log(`Owner:         ${record.owner}`);
            console.log(`Status:        ${record.isReleased ? chalk.green('RELEASED 🔓') : chalk.yellow('LOCKED 🔒')}`);
            console.log(`Release Date:  ${new Date(record.releaseDate * 1000).toLocaleString()}`);
            console.log(`Current Hash:  ${chalk.gray(record.currentDataHash)}`);
            console.log(`Version:       ${record.currentVersion}`);

            if (record.isReleased) {
                console.log(chalk.gray('\nFetching Secret...'));
                const secretCall = '0x' + GET_VAULT_SECRET_SELECTOR + encodeBytes32(dataId);
                const secretResult = await ethCall(config.rpcUrl, contractAddress, secretCall);

                if (secretResult && secretResult !== '0x' + '0'.repeat(64)) {
                    console.log(chalk.green.bold('✅ Secret Found!'));
                    console.log(`Secret:        ${chalk.cyan(secretResult)}`);
                } else {
                    console.log(chalk.yellow('⚠️  Vault released but secret is not available via getVaultSecret.'));
                    console.log(`Entropy:       ${chalk.gray(record.releaseEntropy)}`);
                }
            } else {
                const now = Math.floor(Date.now() / 1000);
                if (now >= record.releaseDate) {
                    console.log(chalk.magenta('\n🕒 Release date has passed! Vault can be finalized.'));
                } else {
                    const hoursLeft = ((record.releaseDate - now) / 3600).toFixed(1);
                    console.log(chalk.gray(`\nTime remaining: ~${hoursLeft} hours`));
                }
            }

        } catch (e: any) {
            console.error(chalk.red(`\n💥 Error: ${e.message}`));
        }
        console.log('\n');
    });

program.parse();
