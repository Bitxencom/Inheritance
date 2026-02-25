/**
 * Low-level ABI encoding/decoding utilities for the Bitxen smart contract.
 *
 * This module handles:
 *  - Function selector computation (keccak256)
 *  - ABI encoding for registerData, updateData, calculateFee
 *  - ABI decoding for tuple return types (getDataRecord, etc.)
 *
 * No external dependencies beyond @noble/hashes (already in the project).
 */

import { keccak_256 } from "@noble/hashes/sha3.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

export function bytesToHex(data: Uint8Array): string {
    let hex = "";
    for (let i = 0; i < data.length; i += 1) {
        hex += data[i].toString(16).padStart(2, "0");
    }
    return hex;
}

export function hexToBytes(hex: string): Uint8Array {
    const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (normalized.length % 2 !== 0) throw new Error("Invalid hex string length");
    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
        bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
    }
    return bytes;
}

export function abiSelector(signature: string): string {
    const bytes = new TextEncoder().encode(signature);
    return bytesToHex(keccak_256(bytes).slice(0, 4));
}

export function encodeBytes32(value: string): string {
    const normalized = value.startsWith("0x") ? value.slice(2) : value;
    if (normalized.length !== 64) throw new Error("Invalid bytes32 length");
    return normalized.toLowerCase();
}

export function encodeUint256(value: bigint): string {
    if (value < BigInt(0)) throw new Error("uint256 must be >= 0");
    return value.toString(16).padStart(64, "0");
}

// ─────────────────────────────────────────────────────────────────────────────
// ABI Encoding — function call builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encode `registerData((bytes32,string,bytes32,uint256,string,string,bool,uint256,bytes32,bytes32))`
 */
export function encodeRegisterData(
    dataHash: string,
    storageURI: string,
    provider: string,
    fileSize: bigint,
    contentType: string,
    fileName: string,
    isPermanent: boolean,
    releaseDate: bigint,
    commitment: string,
    secret: string,
): string {
    const selector = abiSelector(
        "registerData((bytes32,string,bytes32,uint256,string,string,bool,uint256,bytes32,bytes32))",
    );

    const encodeStringToBytes = (str: string): string => {
        const bytes = new TextEncoder().encode(str);
        const lengthHex = bytes.length.toString(16).padStart(64, "0");
        const dataHex = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        return lengthHex + dataHex.padEnd(Math.ceil(bytes.length / 32) * 64, "0");
    };

    const tupleOffset = "0000000000000000000000000000000000000000000000000000000000000020";
    const encodedDataHash = dataHash.startsWith("0x")
        ? dataHash.slice(2).padStart(64, "0")
        : dataHash.padStart(64, "0");

    const encodedProvider = encodeBytes32(provider);
    const encodedFileSize = fileSize.toString(16).padStart(64, "0");
    const encodedIsPermanent = (isPermanent ? 1 : 0).toString(16).padStart(64, "0");
    const encodedReleaseDate = releaseDate.toString(16).padStart(64, "0");
    const encodedCommitment = encodeBytes32(commitment);
    const encodedSecret = encodeBytes32(secret);

    // 10 fields: static size = 10 * 32 = 320 bytes
    const dynamicStart = 10 * 32;
    let currentOffset = dynamicStart;

    const storageURIBytes = new TextEncoder().encode(storageURI).length;
    const contentTypeBytes = new TextEncoder().encode(contentType).length;

    const storageURIOffset = currentOffset;
    currentOffset += 32 + Math.ceil(storageURIBytes / 32) * 32;

    const contentTypeOffset = currentOffset;
    currentOffset += 32 + Math.ceil(contentTypeBytes / 32) * 32;

    const fileNameOffset = currentOffset;

    const encodedParams =
        tupleOffset +
        encodedDataHash +
        storageURIOffset.toString(16).padStart(64, "0") +
        encodedProvider +
        encodedFileSize +
        contentTypeOffset.toString(16).padStart(64, "0") +
        fileNameOffset.toString(16).padStart(64, "0") +
        encodedIsPermanent +
        encodedReleaseDate +
        encodedCommitment +
        encodedSecret +
        encodeStringToBytes(storageURI) +
        encodeStringToBytes(contentType) +
        encodeStringToBytes(fileName);

    return "0x" + selector + encodedParams;
}

/**
 * Encode `updateData(bytes32,bytes32,string,bytes32,uint256)`
 */
export function encodeUpdateData(
    dataId: string,
    newDataHash: string,
    newStorageURI: string,
    newProvider: string,
    newFileSize: bigint,
): string {
    const selector = abiSelector("updateData(bytes32,bytes32,string,bytes32,uint256)");

    const headWords = BigInt(5);
    const stringOffsetBytes = headWords * BigInt(32);

    const uriBytes = new TextEncoder().encode(newStorageURI);
    const uriLen = BigInt(uriBytes.length);
    const uriHex = bytesToHex(uriBytes);
    const uriPadBytes = (32 - (uriBytes.length % 32)) % 32;
    const uriPaddedHex = uriHex + "0".repeat(uriPadBytes * 2);

    const head =
        encodeBytes32(dataId) +
        encodeBytes32(newDataHash) +
        encodeUint256(stringOffsetBytes) +
        encodeBytes32(newProvider) +
        encodeUint256(newFileSize);

    const tail = encodeUint256(uriLen) + uriPaddedHex;

    return "0x" + selector + head + tail;
}

/**
 * Encode `calculateFee()` — no arguments
 */
export function encodeCalculateFee(): string {
    return "0x" + abiSelector("calculateFee()");
}

// ─────────────────────────────────────────────────────────────────────────────
// ABI Decoding
// ─────────────────────────────────────────────────────────────────────────────

function decodeWord(hexNo0x: string, wordIndex: number): string {
    const start = wordIndex * 64;
    const end = start + 64;
    if (end > hexNo0x.length) throw new Error("ABI decode out of bounds");
    return hexNo0x.slice(start, end);
}

function decodeUint256Word(word: string): bigint {
    return BigInt("0x" + word);
}

function decodeAddressWord(word: string): string {
    return "0x" + word.slice(24);
}

function decodeBoolWord(word: string): boolean {
    return BigInt("0x" + word) !== BigInt(0);
}

function decodeStringAtOffset(hexNo0x: string, offsetBytes: bigint): string {
    const offset = Number(offsetBytes);
    if (!Number.isFinite(offset) || offset < 0 || offset % 32 !== 0) {
        throw new Error("Invalid ABI string offset");
    }
    const wordIndex = offset / 32;
    const length = decodeUint256Word(decodeWord(hexNo0x, wordIndex));
    const lengthNumber = Number(length);
    if (!Number.isFinite(lengthNumber) || lengthNumber < 0) {
        throw new Error("Invalid ABI string length");
    }
    const bytesStart = (wordIndex + 1) * 32;
    const startHex = bytesStart * 2;
    const endHex = startHex + lengthNumber * 2;
    if (endHex > hexNo0x.length) throw new Error("ABI string decode out of bounds");
    return new TextDecoder().decode(hexToBytes(hexNo0x.slice(startHex, endHex)));
}

/**
 * Decode a flat ABI tuple/struct response.
 * Automatically detects and skips the `0x20` outer tuple pointer if present.
 */
export function decodeAbiTuple(types: string[], dataHex: string): unknown[] {
    const rawHex = dataHex.startsWith("0x") ? dataHex.slice(2) : dataHex;
    let hexNo0x = rawHex;

    if (rawHex.length >= 64) {
        const firstWord = BigInt("0x" + rawHex.slice(0, 64));
        if (firstWord === BigInt(32)) {
            hexNo0x = rawHex.slice(64);
        }
    }

    if (hexNo0x.length < types.length * 64) {
        throw new Error("Invalid ABI response length");
    }

    const head: unknown[] = new Array(types.length);
    const dynamicOffsets: Array<{ index: number; offset: bigint }> = [];

    for (let i = 0; i < types.length; i += 1) {
        const t = types[i];
        const word = decodeWord(hexNo0x, i);

        if (t === "address") { head[i] = decodeAddressWord(word); continue; }
        if (t === "bytes32") { head[i] = "0x" + word; continue; }
        if (t === "uint8") { head[i] = Number(decodeUint256Word(word)); continue; }
        if (t === "bool") { head[i] = decodeBoolWord(word); continue; }
        if (t === "uint256") { head[i] = decodeUint256Word(word); continue; }
        if (t === "string") { dynamicOffsets.push({ index: i, offset: decodeUint256Word(word) }); continue; }
        throw new Error(`Unsupported ABI type: ${t}`);
    }

    for (const dyn of dynamicOffsets) {
        head[dyn.index] = decodeStringAtOffset(hexNo0x, dyn.offset);
    }

    return head;
}
