import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, FileTextIcon, InfoIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Format tool name for more user-friendly display
  const formatToolName = (name: string) => {
    const toolNames: Record<string, string> = {
      'create_draft': 'Create Draft',
      'add_asset': 'Add Asset',
      'edit_asset': 'Edit Asset',
      'delete_asset': 'Delete Asset',
      'view_all_assets': 'View Assets',
      'search_assets': 'Search Assets'
    };
    return toolNames[name] || name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Parse and format JSON for cleaner display
  const formatJsonDisplay = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  };

  // Format result for more user-friendly display
  const formatResult = (result: any) => {
    if (typeof result === "string") {
      try {
        const parsed = JSON.parse(result);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return result;
      }
    }
    return JSON.stringify(result, null, 2);
  };

  return (
    <div className="aui-tool-fallback-root mb-4 w-full rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="aui-tool-fallback-header flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-100 rounded-full">
            <CheckIcon className="size-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {formatToolName(toolName)}
            </p>
            <p className="text-xs text-gray-500">Command finished successfully</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto"
        >
          {isCollapsed ? <ChevronDownIcon className="size-4" /> : <ChevronUpIcon className="size-4" />}
        </Button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="aui-tool-fallback-content p-4 space-y-4">
          {/* Input Parameters */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileTextIcon className="size-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-900">Input Parameters</h4>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {formatJsonDisplay(argsText)}
              </pre>
            </div>
          </div>

          {/* Result */}
          {result !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <InfoIcon className="size-4 text-green-600" />
                <h4 className="text-sm font-semibold text-gray-900">Result</h4>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {formatResult(result)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolFallback;
