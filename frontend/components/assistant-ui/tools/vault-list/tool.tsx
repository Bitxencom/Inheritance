import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileKey
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPendingVaults,
  getArweaveExplorerUrl,
  type PendingVault,
} from "@/lib/vault-storage";
import { VaultDetailDialog } from "@/components/shared/vault";

export const VaultListTool: ToolCallMessagePartComponent<{
  reason?: string;
}> = ({ args }) => {
  const router = useRouter();
  const [vaults, setVaults] = useState<PendingVault[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedVault, setSelectedVault] = useState<PendingVault | null>(null);

  useEffect(() => {
    // Load vaults from local storage
    const loadedVaults = getPendingVaults();
    setVaults(loadedVaults);
  }, []);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const reason =
    args && typeof args === "object" && "reason" in args
      ? String(
        (args as {
          reason?: string | number | boolean;
        }).reason ?? "",
      ).trim()
      : "";

  return (
    <div className="aui-vault-list-tool mt-3 w-full space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-background p-4 dark:border-muted-foreground/15">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <FileKey className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Your Vaults</h3>
            {reason && (
              <p className="text-sm text-muted-foreground">{reason}</p>
            )}
          </div>
        </div>
      </div>

      {/* Inheritance List */}
      <div className="space-y-3">
        {vaults.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            <Shield className="mb-3 h-10 w-10 opacity-20" />
            <p className="font-medium">You don't have any vaults yet</p>
            <p className="text-sm">You can create your first inheritance by asking me.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {vaults.map((vault) => (
              <div
                key={vault.vaultId}
                className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                  {/* Main Info */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(vault.createdAt).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }).replace(/am|pm/i, m => m.toUpperCase())}
                      </span>
                    </div>

                    {/* IDs */}
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase">Inheritance ID</span>
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs truncate">
                            {vault.vaultId}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => handleCopy(vault.vaultId, vault.vaultId)}
                          >
                            {copiedId === vault.vaultId ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Type:</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${vault.willType === 'one-time'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                            {vault.willType === 'one-time' ? 'One-Time' : 'Editable'}
                          </span>
                        </div>

                        {vault.triggerType && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Release:</span>
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {vault.triggerType === "date"
                                ? `Date: ${vault.triggerDate}`
                                : "By request"}
                            </span>
                          </div>
                        )}
                      </div>

                      {vault.arweaveTxId && (
                        <div className="flex items-center gap-1">
                          <a
                            href={getArweaveExplorerUrl(vault.arweaveTxId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            View on Explorer
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Action */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${vault.status === 'confirmed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                      {vault.status === 'confirmed' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      <span>{vault.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
                    </div>
                    {vault.status === 'confirmed' && vault.confirmedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(vault.confirmedAt).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        }).replace(/am|pm/i, m => m.toUpperCase())}
                      </span>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setSelectedVault(vault)}
                    >
                      View Details
                    </Button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer link to full page */}
      {vaults.length > 0 && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => window.open("/vaults", '_blank')}
          >
            View All Vaults →
          </Button>
        </div>
      )}
      {/* Inheritance Detail Modal */}
      {selectedVault && (
        <VaultDetailDialog
          vault={selectedVault}
          open={selectedVault !== null}
          onOpenChange={(open) => !open && setSelectedVault(null)}
          onVaultUpdate={(updatedVault) => {
            setVaults(vaults.map(v => v.vaultId === updatedVault.vaultId ? updatedVault : v));
          }}
        />
      )}
    </div>
  );
};
