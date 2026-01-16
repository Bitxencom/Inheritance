"use client";

import { useMemo } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/thread-list-sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useTopbarPermanentHide } from "@/hooks/use-persistent-hide";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { UI_CONFIG } from "@/lib/ui-config";
import { createRetryableFetch } from "@/lib/chat-transport";

import { useState } from "react";
import { Upload } from "lucide-react";
import { RestoreVaultDialog } from "@/components/shared/vault/restore-vault-dialog";
import { VaultClaimWizard } from "@/components/assistant-ui/tools/vault-claim-wizard/wizard";
import { VaultEditWizard } from "@/components/assistant-ui/tools/vault-edit-wizard/wizard";
import { BackupData } from "@/lib/backup";

function TopbarContent({ onRestoreClick }: { onRestoreClick: () => void }) {
  const { isPermanentlyHidden: isSidebarHidden } = useSidebar();
  const { isHidden: isTopbarHidden } = useTopbarPermanentHide();

  // If topbar is permanently hidden, don't render
  // if (isTopbarHidden) {
  //   return null;
  // }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
      <div className="flex items-center justify-between gap-2 w-full max-w-[44rem] mx-auto">
        <div className="flex items-center gap-2">
          {!isSidebarHidden && (
            <>
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
            </>
          )}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <div className="flex items-center gap-3">
                  <a href="https://chat.bitxen.com" className="flex items-center">
                    <img
                      src="/logo.png"
                      alt="Bitxen"
                      className="h-8 w-auto hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  </a>
                  <span className="font-semibold italic border rounded-full px-4 py-1 bg-[linear-gradient(1050deg,#000000,#064e3b,#000000)] text-white border-emerald-500 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] text-sm tracking-wide">
                    Digital Inheritance
                  </span>
                </div>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={onRestoreClick}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Open</span>
          </Button>
          <Link href="/vaults" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">View Vaults</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}


export const Assistant = () => {
  // Create transport with custom fetch for retry logic
  const transport = useMemo(() => {
    return new AssistantChatTransport({
      api: "/api/chat",
      fetch: createRetryableFetch({
        maxRetries: 3,
        baseDelayMs: 500,
        retryOnStatus: [400, 429, 500, 502, 503, 504],
      }),
    });
  }, []);

  const runtime = useChatRuntime({ transport });

  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [claimWizardOpen, setClaimWizardOpen] = useState(false);
  const [editWizardOpen, setEditWizardOpen] = useState(false);

  const [initialVaultData, setInitialVaultData] = useState<{
    vaultId: string;
    fractionKeys: string[];
    securityQuestionAnswers: { question: string; answer: string }[];
  } | undefined>(undefined);

  const handleOpenVault = (data: BackupData, securityAnswers: { question: string; answer: string }[]) => {
    console.log("Assistant: handleOpenVault called", data);
    setInitialVaultData({
      vaultId: data.vaultId,
      fractionKeys: data.fractionKeys,
      securityQuestionAnswers: securityAnswers,
    });
    setClaimWizardOpen(true);
    console.log("Assistant: setClaimWizardOpen(true) called");
  };

  const handleEditVault = (data: BackupData, securityAnswers: { question: string; answer: string }[]) => {
    setInitialVaultData({
      vaultId: data.vaultId,
      fractionKeys: data.fractionKeys,
      securityQuestionAnswers: securityAnswers,
    });
    setEditWizardOpen(true);
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <TopbarContent onRestoreClick={() => setRestoreDialogOpen(true)} />
            <div className="flex-1 overflow-hidden">
              <Thread />
            </div>
          </SidebarInset>
        </div>

        <RestoreVaultDialog
          open={restoreDialogOpen}
          onOpenChange={setRestoreDialogOpen}
          onOpenVault={handleOpenVault}
          onEditVault={handleEditVault}
        />

        <VaultClaimWizard
          variant="dialog"
          open={claimWizardOpen}
          onOpenChange={(open) => {
            setClaimWizardOpen(open);
            if (!open) setInitialVaultData(undefined);
          }}
          initialData={initialVaultData}
        />

        <VaultEditWizard
          variant="dialog"
          open={editWizardOpen}
          onOpenChange={(open) => {
            setEditWizardOpen(open);
            if (!open) setInitialVaultData(undefined);
          }}
          initialData={initialVaultData}
        />

      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
