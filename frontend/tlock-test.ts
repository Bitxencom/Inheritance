import * as tlock from "tlock-js";
import { HttpChainClient, HttpCachingChain } from "drand-client";

const QUICKNET_URL = "https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
// const QUICKNET_URL = "https://drand.cloudflare.com";
const QUICKNET_CHAIN_HASH = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const QUICKNET_PUBLIC_KEY = "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a";

async function run() {
    const chainClient = new HttpChainClient(new HttpCachingChain(QUICKNET_URL), {
        disableBeaconVerification: false,
        noCache: false,
        chainVerificationParams: {
            chainHash: QUICKNET_CHAIN_HASH,
            publicKey: QUICKNET_PUBLIC_KEY,
        }
    });

    const round = 10000;
    console.log("Sealing...");
    console.time("seal");
    const sealed = await tlock.timelockEncrypt(round, Buffer.from("hello world"), chainClient);
    console.timeEnd("seal");

    console.log("Decrypting...");
    console.time("decrypt");
    const recovered = await tlock.timelockDecrypt(sealed, chainClient);
    console.timeEnd("decrypt");
    console.log(Buffer.from(recovered).toString());
}
run().catch(console.error);
