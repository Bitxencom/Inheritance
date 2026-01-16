import { ThreadPrimitive } from "@assistant-ui/react";
import { useCallback, useRef, type FC } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

import { Composer, EditComposer } from "@/components/assistant-ui/thread/composer";
import ThreadWelcome from "@/components/assistant-ui/thread/thread-welcome";
import { AssistantMessage } from "@/components/assistant-ui/messages/assistant-message";
import UserMessage from "@/components/assistant-ui/messages/user-message";

export const Thread: FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <ThreadPrimitive.Root
          className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
          style={{
            ["--thread-max-width" as string]: "44rem",
          }}
        >
          <ThreadPrimitive.Viewport
            ref={containerRef}
            autoScroll
            className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll px-4"
          >
            <ThreadWelcome />

            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                EditComposer,
                AssistantMessage,
              }}
            />
            <ThreadPrimitive.If empty={false}>
              <div className="aui-thread-viewport-spacer min-h-8 grow" />
            </ThreadPrimitive.If>
            <Composer onScrollToBottom={scrollToBottom} />
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </MotionConfig>
    </LazyMotion>
  );
};

