
import * as m from "motion/react-m";
import { FC } from "react";
import { Button } from "@/components/ui/button";
import { ThreadPrimitive } from "@assistant-ui/react";

const ThreadWelcomeSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions mx-auto mb-4 grid w-full max-w-[var(--thread-max-width)] gap-2 sm:grid-cols-2">
      {[
        {
          title: "Create New Inheritance",
          label: "create and secure your assets",
          action: "I'd like to create a new inheritance",
        },
        {
          title: "Open or Unlock Inheritance",
          label: "open and access inheritance",
          action: "I want to open or unlock my inheritance",
        },
        {
          title: "View Inheritances",
          label: "view inheritance history",
          action: "Show me my inheritance history",
        },
        {
          title: "Edit Existing Inheritance",
          label: "modify content or data of inheritance",
          action: "I need to edit a inheritance",
        },
      ].map((suggestedAction, index) => {
        const isVaultAction =
          suggestedAction.action === "I'd like to create a new inheritance";

        return (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.05 * index }}
            key={`suggested-action-${suggestedAction.title}-${index}`}
            className="aui-thread-welcome-suggestion-display"
          >
            {isVaultAction ? (
              <ThreadPrimitive.Suggestion
                prompt={suggestedAction.action}
                method="replace"
                autoSend
                asChild
              >
                <Button
                  variant="ghost"
                  className="aui-thread-welcome-suggestion h-auto w-full flex-1 flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm sm:flex-col dark:hover:bg-accent/60"
                  aria-label={suggestedAction.action}
                >
                  <span className="aui-thread-welcome-suggestion-text-1 font-medium">
                    {suggestedAction.title}
                  </span>
                  <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
                    {suggestedAction.label}
                  </span>
                </Button>
              </ThreadPrimitive.Suggestion>
            ) : (
              <ThreadPrimitive.Suggestion
                prompt={suggestedAction.action}
                method="replace"
                autoSend
                asChild
              >
                <Button
                  variant="ghost"
                  className="aui-thread-welcome-suggestion h-auto w-full flex-1 flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm sm:flex-col dark:hover:bg-accent/60"
                  aria-label={suggestedAction.action}
                >
                  <span className="aui-thread-welcome-suggestion-text-1 font-medium">
                    {suggestedAction.title}
                  </span>
                  <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
                    {suggestedAction.label}
                  </span>
                </Button>
              </ThreadPrimitive.Suggestion>
            )}
          </m.div>
        );
      })}
    </div>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <ThreadPrimitive.Empty>
      <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
        <div className="aui-thread-welcome-center flex w-full flex-grow flex-col items-center justify-center">
          <div className="aui-thread-welcome-message flex size-full flex-col justify-start lg:justify-center mt-12 lg:mt-0 px-8">
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="aui-thread-welcome-message-motion-1 text-2xl font-semibold"
            >
              Welcome!
            </m.div>
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.1 }}
              className="aui-thread-welcome-message-motion-2 text-xl text-gray-500 dark:text-gray-300"
            >
              How can I assist you with your digital inheritance today?
            </m.div>
          </div>
        </div>
      </div>
      <ThreadWelcomeSuggestions />
    </ThreadPrimitive.Empty>
  );
};

export default ThreadWelcome;