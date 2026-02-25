#!/usr/bin/env npx tsx

import { Command } from 'commander';
import chalk from 'chalk';
import { HttpChainClient, HttpCachingChain, fetchBeacon } from "drand-client";

const program = new Command();

// Mainnet Drand Quicknet (3s interval verified from project code)
const QUICKNET_CHAIN_HASH = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const QUICKNET_PUBLIC_KEY = "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a";
const QUICKNET_URL = "https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const QUICKNET_GENESIS_TIME = 1692803367000;
const QUICKNET_PERIOD = 3000;

function timestampToDrandRound(timestampMs: number): number {
    if (timestampMs < QUICKNET_GENESIS_TIME) return 1;
    const elapsed = timestampMs - QUICKNET_GENESIS_TIME;
    return Math.floor(elapsed / QUICKNET_PERIOD) + 1;
}

function roundToTimestamp(round: number): number {
    return QUICKNET_GENESIS_TIME + (round - 1) * QUICKNET_PERIOD;
}

program
    .name('drand-checker')
    .description('Check Drand Quicknet status and verify rounds')
    .option('-r, --round <number>', 'Specific Drand round to check')
    .option('-t, --time <string>', 'Timestamp or ISO date (e.g. "2025-12-31")')
    .option('-i, --inspect', 'Get current network info and latest beacon', false)
    .action(async (options) => {
        console.log(chalk.blue.bold(`\n🌩️  Drand Quicknet Checker`));

        try {
            const chainOptions = {
                disableBeaconVerification: false,
                noCache: false,
                chainVerificationParams: {
                    chainHash: QUICKNET_CHAIN_HASH,
                    publicKey: QUICKNET_PUBLIC_KEY,
                }
            };
            const chainClient = new HttpChainClient(new HttpCachingChain(QUICKNET_URL), chainOptions);

            const now = Date.now();
            const currentRound = timestampToDrandRound(now);

            if (options.inspect || (!options.round && !options.time)) {
                console.log(chalk.white.bold('\n--- Current Network Status ---'));
                console.log(`Current Time:  ${new Date(now).toLocaleString()}`);
                console.log(`Current Round: ${chalk.yellow(currentRound)}`);

                console.log(chalk.gray('Fetching latest beacon...'));
                const latest = await fetchBeacon(chainClient);
                console.log(`Latest Round:  ${chalk.green(latest.round)}`);
                console.log(`Signature:     ${chalk.cyan(latest.signature.substring(0, 32) + '...')}`);
            }

            let targetRound: number | null = null;

            if (options.round) {
                targetRound = parseInt(options.round);
            } else if (options.time) {
                const date = new Date(options.time);
                if (isNaN(date.getTime())) {
                    throw new Error('Invalid date format. Use ISO strings or YYYY-MM-DD');
                }
                targetRound = timestampToDrandRound(date.getTime());
                console.log(chalk.white.bold('\n--- Time to Round Conversion ---'));
                console.log(`Target Time:   ${date.toLocaleString()}`);
                console.log(`Target Round:  ${chalk.yellow(targetRound)}`);
            }

            if (targetRound) {
                console.log(chalk.white.bold(`\n--- Beacon Verification for Round ${targetRound} ---`));

                const targetTime = roundToTimestamp(targetRound);
                console.log(`Estim. Release: ${new Date(targetTime).toLocaleString()}`);

                if (targetRound > currentRound) {
                    const diffMs = targetTime - now;
                    const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
                    console.log(`Status:         ${chalk.yellow('FUTURE ⏳')}`);
                    console.log(`Available In:   ${chalk.bold(diffHours)} hours`);
                } else {
                    console.log(chalk.gray(`Fetching beacon for round ${targetRound}...`));
                    try {
                        const beacon = await fetchBeacon(chainClient, targetRound);
                        console.log(`Status:         ${chalk.green('AVAILABLE ✅')}`);
                        console.log(`Signature:     ${chalk.cyan(beacon.signature)}`);
                        console.log(`Randomness:    ${chalk.magenta(beacon.randomness)}`);
                    } catch (e: any) {
                        console.log(`Status:         ${chalk.red('NOT FOUND ❌')}`);
                        console.log(`Error:          ${e.message}`);
                    }
                }
            }

        } catch (error: any) {
            console.error(chalk.red(`\n💥 Error: ${error.message}`));
        }
        console.log('\n');
    });

program.parse();
