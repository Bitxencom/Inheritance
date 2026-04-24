'use client';

import { useEffect, useRef, useState } from 'react';
import { finalizeRelease, waitForTransaction, readBitxenDataRecord, CHAIN_CONFIG } from '@/lib/metamaskWallet';
import type { ChainId } from '@/lib/chains';

type Status = 'loading' | 'ready' | 'backend' | 'metamask' | 'waiting-tx' | 'success' | 'error';

export default function ExtensionFinalizePage() {
    const [status, setStatus] = useState<Status>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [txHash, setTxHash] = useState('');

    const paramsRef = useRef<{
        contractDataId: string;
        vaultId: string;
        extId: string;
        chainKey: ChainId;
        contractAddress: string;
    } | null>(null);

    const sendResult = (success: boolean, releaseEntropy?: string, error?: string) => {
        const { extId } = paramsRef.current!;
        try {
            const chromeRuntime = (window as any).chrome?.runtime;
            if (chromeRuntime) {
                chromeRuntime.sendMessage(
                    extId,
                    { type: 'BITXEN_FINALIZE_RESULT', success, releaseEntropy, error },
                    () => { void chromeRuntime.lastError; }
                );
            }
        } catch {
            // Extension may not be listening; user can close tab manually
        }
        if (success) {
            setTimeout(() => window.close(), 1500);
        }
    };

    const fetchEntropyFromChain = async (chainKey: ChainId, contractDataId: string, contractAddress: string): Promise<string | null> => {
        try {
            const record = await readBitxenDataRecord({ chainId: chainKey, contractDataId, contractAddress });
            const entropy = record.releaseEntropy as string | undefined;
            const ZERO = '0x' + '0'.repeat(64);
            return entropy && entropy !== ZERO ? entropy : null;
        } catch {
            return null;
        }
    };

    const tryBackendFinalize = async (vaultId: string, chainKey: string, contractDataId: string, contractAddress: string): Promise<string | null> => {
        try {
            const res = await fetch('/api/vault/claim/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vaultId, chain: chainKey, contractDataId, contractAddress }),
            });
            const data = await res.json().catch(() => ({})) as { success?: boolean; releaseEntropy?: string };
            const ZERO = '0x' + '0'.repeat(64);
            if (res.ok && data.success && data.releaseEntropy && data.releaseEntropy !== ZERO) {
                return data.releaseEntropy;
            }
        } catch {
            // backend unreachable
        }
        return null;
    };

    const handleMetaMaskFinalize = async () => {
        const p = paramsRef.current!;
        setStatus('metamask');
        setErrorMsg('');
        try {
            const config = CHAIN_CONFIG[p.chainKey];
            const hash = await finalizeRelease({
                chainId: p.chainKey,
                contractDataId: p.contractDataId,
                contractAddress: p.contractAddress,
            });
            setTxHash(hash);
            setStatus('waiting-tx');

            await waitForTransaction(hash, 60, config.rpcUrl);

            const entropy = await fetchEntropyFromChain(p.chainKey, p.contractDataId, p.contractAddress);
            if (!entropy) throw new Error('Transaction confirmed but releaseEntropy is still empty on-chain. Please wait a moment and retry.');

            setStatus('success');
            sendResult(true, entropy);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'MetaMask finalization failed.';
            setStatus('error');
            setErrorMsg(msg);
            sendResult(false, undefined, msg);
        }
    };

    useEffect(() => {
        const run = async () => {
            const sp = new URLSearchParams(window.location.search);
            const contractDataId = sp.get('contractDataId') ?? '';
            const vaultId = sp.get('vaultId') ?? '';
            const extId = sp.get('extId') ?? '';
            const chainKey = (sp.get('chainKey') ?? 'bscTestnet') as ChainId;
            const contractAddress = sp.get('contractAddress') ?? '';

            if (!contractDataId || !extId) {
                setStatus('error');
                setErrorMsg('Missing required parameters (contractDataId or extId).');
                return;
            }

            paramsRef.current = { contractDataId, vaultId, extId, chainKey, contractAddress };

            setStatus('backend');
            const entropy = await tryBackendFinalize(vaultId, chainKey, contractDataId, contractAddress);
            if (entropy) {
                setStatus('success');
                sendResult(true, entropy);
                return;
            }

            setStatus('ready');
        };
        run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#0a0a0a', color: '#f0f0f0', fontFamily: 'sans-serif', padding: '2rem',
        }}>
            <div style={{
                maxWidth: 420, width: '100%', background: '#141414',
                borderRadius: 16, border: '1px solid #2a2a2a', padding: '2rem', textAlign: 'center',
            }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>Bitxen Inheritance — Finalize Vault Release</h1>

                {status === 'loading' && (
                    <p style={{ color: '#888' }}>Initializing...</p>
                )}

                {status === 'backend' && (
                    <p style={{ color: '#888' }}>Trying backend-sponsored finalization...</p>
                )}

                {status === 'ready' && (
                    <>
                        <p style={{ color: '#aaa', marginBottom: 24, fontSize: '0.9rem' }}>
                            Backend finalization is unavailable. Please finalize via MetaMask.
                            Your wallet will pay a small gas fee to release this vault.
                        </p>
                        <button
                            onClick={handleMetaMaskFinalize}
                            style={{
                                background: '#e2761b', color: '#fff', border: 'none',
                                borderRadius: 8, padding: '0.75rem 1.5rem',
                                fontSize: '1rem', fontWeight: 600, cursor: 'pointer', width: '100%',
                            }}
                        >
                            🦊 Finalize with MetaMask
                        </button>
                    </>
                )}

                {status === 'metamask' && (
                    <p style={{ color: '#bb9854' }}>Waiting for MetaMask confirmation...</p>
                )}

                {status === 'waiting-tx' && (
                    <>
                        <p style={{ color: '#bb9854' }}>Transaction submitted. Waiting for confirmation...</p>
                        {txHash && (
                            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 8, wordBreak: 'break-all' }}>
                                Tx: {txHash}
                            </p>
                        )}
                    </>
                )}

                {status === 'success' && (
                    <p style={{ color: '#4caf50', fontWeight: 600 }}>
                        ✅ Vault released successfully! You can close this tab.
                    </p>
                )}

                {status === 'error' && (
                    <>
                        <p style={{ color: '#f44336', marginBottom: 16 }}>❌ {errorMsg}</p>
                        {paramsRef.current && (
                            <button
                                onClick={handleMetaMaskFinalize}
                                style={{
                                    background: '#e2761b', color: '#fff', border: 'none',
                                    borderRadius: 8, padding: '0.75rem 1.5rem',
                                    fontSize: '1rem', fontWeight: 600, cursor: 'pointer', width: '100%',
                                }}
                            >
                                🦊 Retry with MetaMask
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
