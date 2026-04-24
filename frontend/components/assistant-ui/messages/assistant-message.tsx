import {
  ActionBarPrimitive,
  MessagePrimitive,
  useMessage,
} from "@assistant-ui/react";
import { Thinking } from "@/components/assistant-ui/thinking";
import {
  CheckIcon,
  CopyIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { FC } from "react";

import { MarkdownText } from "@/components/assistant-ui/shared/markdown-text";
import { TooltipIconButton } from "@/components/assistant-ui/shared/tooltip-icon-button";
import BranchPicker from "@/components/assistant-ui/thread/branch-picker";
import MessageError from "@/components/assistant-ui/messages/message-error";
import ToolFallback from "@/components/assistant-ui/tools/tool-fallback";
import { VaultCreationWizardTool } from "@/components/assistant-ui/tools/vault-creation-wizard";
import { VaultClaimWizardTool } from "@/components/assistant-ui/tools/vault-claim-wizard";
import { VaultEditWizardTool } from "@/components/assistant-ui/tools/vault-edit-wizard";
import { CostEstimationTool } from "@/components/assistant-ui/tools/cost-estimation";
import { RAGTool } from "@/components/assistant-ui/tools/rag-tool";
import { VaultListTool } from "@/components/assistant-ui/tools/vault-list";
import { VaultDetailTool } from "@/components/assistant-ui/tools/vault-detail";

export const AssistantMessage: FC = () => {
  const { status, content } = useMessage();
  const isThinking = status?.type === "running" && (!content || content.length === 0);

  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-200 fade-in slide-in-from-bottom-1 last:mb-24"
        data-role="assistant"
      >
        <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground">
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              tools: {
                by_name: {
                  open_vault_wizard: VaultCreationWizardTool,
                  open_vault_claim_wizard: VaultClaimWizardTool,
                  open_vault_edit_wizard: VaultEditWizardTool,
                  estimate_arweave_cost: CostEstimationTool,
                  show_vault_list: VaultListTool,
                  show_vault_detail: VaultDetailTool,
                  // RAG tools - display as regular chat message
                  search_service_information: RAGTool,
                  search_vaults: RAGTool,
                },
                Fallback: ToolFallback,
              },
            }}
          />
          {isThinking && <Thinking />}
          <MessageError />
        </div>

        {/* <div className="aui-assistant-message-footer mt-2 ml-2 flex">
          <BranchPicker />
          <AssistantActionBar />
        </div> */}
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

