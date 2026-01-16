import { ThreadPrimitive } from "@assistant-ui/react";
import { TooltipIconButton } from "@/components/assistant-ui/shared/tooltip-icon-button";
import { ArrowDownIcon } from "lucide-react";
import { FC } from "react";

const ThreadScrollToBottom: FC<{ onScrollToBottom: () => void }> = ({
  onScrollToBottom,
}) => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
        onClick={onScrollToBottom}
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

export default ThreadScrollToBottom;
