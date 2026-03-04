#!/usr/bin/env npx tsx

import { Command } from 'commander';
import Arweave from 'arweave';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load .env from project root if it exists
dotenv.config({ path: '../.env' });

const program = new Command();

const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});

program
    .name('inspect-vault')
    .description('Inspect an Arweave vault transaction for Deheritance')
    .argument('<txId>', 'Arweave Transaction ID')
    .option('-v, --verbose', 'Display full raw payload', false)
    .action(async (txId, options) => {
        console.log(chalk.blue.bold(`\n🔍 Inspecting Vault: ${txId}\n`));

        try {
            // 1. Fetch Transaction Metadata via GraphQL
            const query = {
                query: `
          query {
            transaction(id: "${txId}") {
              id
              owner { address }
              block {
                height
                timestamp
              }
              tags {
                name
                value
              }
              data {
                size
                type
              }
            }
          }
        `,
            };

            const response = await fetch('https://arweave.net/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(query),
            });

            const gqlResult = await response.json();
            const tx = gqlResult?.data?.transaction;

            if (!tx) {
                console.log(chalk.red('❌ Transaction not found or not yet indexed by GraphQL.'));

                // Try fallback to REST for basic existence check
                try {
                    const status = await arweave.transactions.getStatus(txId);
                    console.log(chalk.yellow(`Status from REST: ${status.status} (${status.confirmed ? 'Confirmed' : 'Pending'})`));
                } catch (e) {
                    console.log(chalk.red('Fallback check also failed.'));
                }
                return;
            }

            // Display Status
            const isConfirmed = !!tx.block;
            console.log(chalk.white.bold('--- Block Info ---'));
            console.log(`Status:    ${isConfirmed ? chalk.green('Confirmed ✅') : chalk.yellow('Pending ⏳')}`);
            if (isConfirmed) {
                console.log(`Height:    ${tx.block.height}`);
                console.log(`Time:      ${new Date(tx.block.timestamp * 1000).toLocaleString()}`);
            }
            console.log(`Owner:     ${tx.owner.address}`);
            console.log(`Data Size: ${tx.data.size} bytes`);

            // Display Tags
            console.log(chalk.white.bold('\n--- Arweave Tags ---'));
            const tags: Record<string, string> = {};
            tx.tags.forEach((tag: { name: string; value: string }) => {
                tags[tag.name] = tag.value;
                console.log(`${chalk.cyan(tag.name.padEnd(20))}: ${tag.value}`);
            });

            // 2. Fetch Actual Data
            console.log(chalk.white.bold('\n--- Vault Payload ---'));
            const dataResponse = await fetch(`https://arweave.net/${txId}`);
            if (!dataResponse.ok) {
                throw new Error(`Failed to fetch data: ${dataResponse.statusText}`);
            }

            const rawData = await dataResponse.text();
            try {
                const payload = JSON.parse(rawData);

                // Extract interesting parts
                console.log(`${chalk.cyan('App-Name')}: ${payload.appName || 'N/A'}`);
                console.log(`${chalk.cyan('Vault ID')}: ${payload.vaultId || 'N/A'}`);
                console.log(`${chalk.cyan('Will Type')}: ${payload.willType || 'N/A'}`);

                if (payload.metadata) {
                    console.log(chalk.yellow('\nMetadata Found:'));
                    console.log(`- Storage:   ${payload.metadata.storageType || 'N/A'}`);
                    console.log(`- Hybrid:    ${!!(payload.metadata.blockchainChain) ? chalk.green('Yes') : 'No'}`);
                    if (payload.metadata.releaseDate) {
                        console.log(`- Release:   ${payload.metadata.releaseDate}`);
                    }
                }

                if (options.verbose) {
                    console.log(chalk.white.bold('\n--- Full JSON Payload ---'));
                    console.log(JSON.stringify(payload, null, 2));
                } else {
                    console.log(chalk.gray('\n(Use --verbose to see full encrypted content)'));
                }

            } catch (e) {
                console.log(chalk.yellow('Data is not JSON or is malformed:'));
                console.log(rawData.substring(0, 500) + (rawData.length > 500 ? '...' : ''));
            }

        } catch (error: any) {
            console.error(chalk.red(`\n💥 Error: ${error.message}`));
        }
        console.log('\n');
    });

program.parse();
