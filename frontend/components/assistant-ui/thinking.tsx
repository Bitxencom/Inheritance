import { Loader2 } from "lucide-react";
import { type FC } from "react";

export const Thinking: FC = () => {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Thinking...</span>
    </div>
  );
};
