'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle } from 'lucide-react'
import WanderLogo from "@/assets/logo/wander.svg";
import Image from "next/image";

import {
  connectWanderWallet,
  getConnectedAddress,
  formatWalletAddress,
  isUsingWanderConnect,
  preloadWanderConnect
} from '@/lib/wanderWallet'

interface WanderWalletButtonProps {
  onClick: () => Promise<void> | void
  disabled?: boolean
  className?: string
  amount?: string
  label?: string
}

export function WanderWalletButton({
  onClick,
  disabled = false,
  className = '',
  amount,
  label
}: WanderWalletButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showBackupWarning, setShowBackupWarning] = useState(false)

  // Preload Wander Connect script on mount to avoid popup blocking
  useEffect(() => {
    preloadWanderConnect();
  }, [])

  const handleConnect = async () => {
    setError(null)
    setIsConnecting(true)

    try {
      // Check if already connected
      let address = await getConnectedAddress()

      if (!address) {
        // connectWanderWallet handles both extension and Wander Connect fallback
        address = await connectWanderWallet()
      }

      setWalletAddress(address)
      setIsConnected(true)

      // Show backup warning if using Wander Connect (embedded wallet)
      if (isUsingWanderConnect()) {
        setShowBackupWarning(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Wander Wallet')
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const handlePayment = async () => {
    if (!isConnected) {
      await handleConnect()
      return
    }
    await onClick()
  }

  if (disabled) {
    return (
      <Button disabled className={`w-full h-12 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium text-base ${className}`}>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-full bg-purple-100 p-1.5 dark:bg-purple-900 h-8 w-8">
            <Image
              src={WanderLogo}
              alt="Wander Wallet"
            />
          </div>
          Pay with Wander Wallet
        </div>
      </Button>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Button
        onClick={handlePayment}
        disabled={isConnecting}
        className="w-full h-12 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium text-base"
      >
        {isConnecting ? (
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            Connecting...
          </div>
        ) : isConnected ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-full bg-purple-100 p-1.5 dark:bg-purple-900 h-8 w-8">
              <Image
                src={WanderLogo}
                alt="Wander Wallet"
              />
            </div>
            {label ? label : (amount ? `Pay ${amount} AR` : 'Pay with AR')}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-full bg-purple-100 p-1.5 dark:bg-purple-900 h-8 w-8">
              <Image
                src={WanderLogo}
                alt="Wander Wallet"
              />
            </div>
            Connect Wander Wallet
          </div>
        )}
      </Button>

      {isConnected && walletAddress && (
        <p className="text-xs text-muted-foreground text-center">
          Connected: {formatWalletAddress(walletAddress)}
        </p>
      )}

      {/* Backup Warning for Wander Connect users */}
      {/* {showBackupWarning && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400">
            <p className="font-semibold mb-1">Important: Backup Your Wallet</p>
            <p>
              Your wallet is stored in this browser. If you clear browser data or use a different device,
              you may lose access. Please backup your wallet in the Wander Connect settings.
            </p>
          </div>
        </div>
      )} */}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}