"use client";


import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import {
  CheckCircle2Icon,
  AlertTriangleIcon,
  InfoIcon,
  BookOpenIcon,
  FileTextIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// import "@assistant-ui/react-markdown/styles/dot.css";
import { useState, useCallback } from "react";

/**
 * Custom tool component for RAG tools that displays text content
 * with premium and modern design
 */
export const RAGTool: ToolCallMessagePartComponent = ({
  toolName,
  result,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Extract text content and sources from result
  const extractTextContent = (result: unknown): { text: string; sources?: string[]; quality?: QualityMetadata } | string | null => {
    if (!result) return null;

    // If result is string, try to parse as JSON
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result) as Record<string, unknown>;
        const extracted = extractTextFromParsed(parsed);
        return extracted || result;
      } catch {
        // If not JSON, return directly as text
        return result;
      }
    }

    // If result is object
    if (typeof result === 'object' && result !== null) {
      return extractTextFromParsed(result as Record<string, unknown>);
    }

    return null;
  };

  type ContentItem = {
    type?: string;
    text?: string;
  };

  type QualityMetadata = {
    confidence?: 'high' | 'medium' | 'low';
    sourceCount?: number;
    hasResults?: boolean;
  };

  type ParsedResult = {
    content?: ContentItem[];
    text?: string;
    data?: {
      combinedContext?: string;
      quality?: QualityMetadata;
    };
  };

  const extractTextFromParsed = (parsed: ParsedResult | Record<string, unknown>): { text: string; sources?: string[]; quality?: QualityMetadata } | null => {
    let text = '';
    let sources: string[] = [];

    // Format: { content: [{ type: 'text', text: '...' }] }
    if (parsed?.content && Array.isArray(parsed.content)) {
      const textParts = parsed.content
        .filter((item: ContentItem) => item.type === 'text' && item.text)
        .map((item: ContentItem) => item.text);

      if (textParts.length > 0) {
        text = textParts.join('\n\n');
      }
    }

    // Format: { text: '...' }
    if (parsed?.text && typeof parsed.text === 'string') {
      text = parsed.text;
    }

    // Format: { data: { combinedContext: '...' } }
    if ('data' in parsed && parsed.data && typeof parsed.data === 'object' && 'combinedContext' in parsed.data) {
      const combinedContext = (parsed.data as { combinedContext?: string }).combinedContext;
      if (combinedContext) {
        text = combinedContext;
      }
    }

    if (!text) return null;

    // Extract metadata from HTML comment at end of text
    // Format: <!-- RAG_METADATA:{"sources":[...],"query":"..."} -->
    const metadataMatch = text.match(/<!--\s*RAG_METADATA:([\s\S]+?)\s*-->/);
    if (metadataMatch) {
      try {
        const metadata = JSON.parse(metadataMatch[1]) as { sources?: string[] };
        if (metadata.sources && Array.isArray(metadata.sources)) {
          sources = metadata.sources;
        }
        // Remove metadata comment from text
        text = text.replace(/<!--\s*RAG_METADATA:[\s\S]+?\s*-->/, '').trim();
      } catch {
        // Ignore parse error
      }
    }

    // Clean up text: remove [Source: ...] patterns that might still exist
    if (text) {
      text = text.replace(/\[Source:\s*([^\]]+)\]\n?/gi, '');
      text = text.trim();
    }

    if (!text) return null;

    // Extract quality metadata
    const quality = ('data' in parsed && parsed.data && typeof parsed.data === 'object' && 'quality' in parsed.data)
      ? (parsed.data as { quality?: QualityMetadata }).quality
      : undefined;

    return { text, sources: sources.length > 0 ? sources : undefined, quality };
  };

  const extracted = extractTextContent(result);
  const textContent = typeof extracted === 'string' ? extracted : extracted?.text;
  const sources = typeof extracted === 'object' && extracted?.sources ? extracted.sources : undefined;
  const quality = typeof extracted === 'object' && extracted?.quality ? extracted.quality : undefined;

  // If no text content, return null to use ToolFallback
  if (!textContent || textContent.trim().length === 0) {
    return null;
  }

  // Format tool name for display
  const getToolDisplayInfo = (name: string): { label: string; icon: React.ElementType; gradient: string; iconBg: string } => {
    const toolInfo: Record<string, { label: string; icon: React.ElementType; gradient: string; iconBg: string }> = {
      'search_service_information': {
        label: "Service Info",
        icon: BookOpenIcon,
        gradient: 'from-emerald-500 to-teal-600',
        iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500'
      },
      'search_vaults': {
        label: "Inheritance Search",
        icon: SparklesIcon,
        gradient: 'from-violet-500 to-purple-600',
        iconBg: 'bg-gradient-to-br from-violet-400 to-purple-500'
      },
    };
    return toolInfo[name] || {
      label: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      icon: FileTextIcon,
      gradient: 'from-blue-500 to-indigo-600',
      iconBg: 'bg-gradient-to-br from-blue-400 to-indigo-500'
    };
  };

  // Format source file name (remove .md extension, capitalize)
  const formatSourceName = (fileName: string): string => {
    return fileName
      .replace(/\.md$/i, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get quality indicator with enhanced styling
  const getQualityIndicator = () => {
    if (!quality) return null;

    const confidence = quality.confidence || 'medium';
    const sourceCount = quality.sourceCount || 0;
    const hasResults = quality.hasResults !== false;

    if (!hasResults || sourceCount === 0) {
      return {
        icon: AlertTriangleIcon,
        text: "No references available",
        bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40',
        borderColor: 'border-amber-200/60 dark:border-amber-700/40',
        iconColor: 'text-amber-500 dark:text-amber-400',
        textColor: 'text-amber-700 dark:text-amber-300',
      };
    }

    if (confidence === 'low') {
      return {
        icon: AlertTriangleIcon,
        text: "Limited references - this answer may be less precise",
        bgGradient: 'from-yellow-50 to-amber-50 dark:from-yellow-950/40 dark:to-amber-950/40',
        borderColor: 'border-yellow-200/60 dark:border-yellow-700/40',
        iconColor: 'text-yellow-500 dark:text-yellow-400',
        textColor: 'text-yellow-700 dark:text-yellow-300',
      };
    }

    if (confidence === 'medium') {
      return {
        icon: InfoIcon,
        text: `Based on ${sourceCount} reference sources`,
        bgGradient: 'from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/40',
        borderColor: 'border-sky-200/60 dark:border-sky-700/40',
        iconColor: 'text-sky-500 dark:text-sky-400',
        textColor: 'text-sky-700 dark:text-sky-300',
      };
    }

    // high confidence
    return {
      icon: CheckCircle2Icon,
      text: `Verified by ${sourceCount} relevant sources`,
      bgGradient: 'from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40',
      borderColor: 'border-emerald-200/60 dark:border-emerald-700/40',
      iconColor: 'text-emerald-500 dark:text-emerald-400',
      textColor: 'text-emerald-700 dark:text-emerald-300',
    };
  };

  const qualityIndicator = getQualityIndicator();
  const toolInfo = getToolDisplayInfo(toolName);
  const ToolIcon = toolInfo.icon;

  // Source badge colors - rotating gradient colors for visual variety
  const sourceBadgeColors = [
    'from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 border-violet-200/60 dark:border-violet-700/40 text-violet-700 dark:text-violet-300',
    'from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 border-blue-200/60 dark:border-blue-700/40 text-blue-700 dark:text-blue-300',
    'from-teal-100 to-emerald-100 dark:from-teal-900/40 dark:to-emerald-900/40 border-teal-200/60 dark:border-teal-700/40 text-teal-700 dark:text-teal-300',
    'from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40 border-orange-200/60 dark:border-orange-700/40 text-orange-700 dark:text-orange-300',
    'from-pink-100 to-rose-100 dark:from-pink-900/40 dark:to-rose-900/40 border-pink-200/60 dark:border-pink-700/40 text-pink-700 dark:text-pink-300',
  ];

  return (
    <div className="aui-rag-tool-root mt-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Main Card with glassmorphism effect */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-background to-muted/20 shadow-lg shadow-black/5 dark:shadow-black/20 dark:border-white/10 backdrop-blur-sm">

        {/* Decorative gradient orb in background */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-gradient-to-tr from-primary/5 to-transparent blur-2xl" />

        {/* Header Section */}
        <div className="relative flex items-center justify-between gap-3 border-b border-border/40 bg-gradient-to-r from-muted/30 to-muted/10 px-6 py-5">
          <div className="flex items-center gap-3">
            {/* Animated Icon Container */}
            <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${toolInfo.iconBg}`}>
              <ToolIcon className="h-5 w-5 text-white" strokeWidth={2} />
              {/* Subtle pulse animation */}
              <div className="absolute inset-0 rounded-xl bg-white/20 animate-pulse" style={{ animationDuration: '3s' }} />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <CheckCircle2Icon className="h-4 w-4 text-emerald-500" />
                <span className="text-lg font-semibold text-foreground tracking-tight">
                  {toolInfo.label}
                </span>
              </div>
              {sources && sources.length > 0 && (
                <span className="text-xs text-muted-foreground mt-0.5">
                  {sources.length === 1 ? "1 reference source" : `${sources.length} reference sources`}
                </span>
              )}
            </div>
          </div>

          {/* Source count badge */}
          {sources && sources.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 px-3 py-1.5 border border-primary/20">
                <FileTextIcon className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  {sources.length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quality indicator - Enhanced Design */}
        {qualityIndicator && (
          <div className={`mx-6 mt-5 flex items-center gap-3 rounded-xl border ${qualityIndicator.borderColor} bg-gradient-to-r ${qualityIndicator.bgGradient} px-5 py-4`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${qualityIndicator.iconColor} bg-white/60 dark:bg-black/20`}>
              <qualityIndicator.icon className="h-4 w-4" strokeWidth={2} />
            </div>
            <p className={`text-sm font-medium ${qualityIndicator.textColor}`}>
              {qualityIndicator.text}
            </p>
          </div>
        )}

        {/* Content Section with collapse animation */}
        <div className="px-6 py-6">
          {/* Toggle Button */}
          <button
            onClick={toggleExpand}
            className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 group"
          >
            {isExpanded ? (
              <>
                <ChevronUpIcon className="h-4 w-4 transform group-hover:-translate-y-0.5 transition-transform" />
                <span>Hide details</span>
              </>
            ) : (
              <>
                <ChevronDownIcon className="h-4 w-4 transform group-hover:translate-y-0.5 transition-transform" />
                <span>Show details</span>
              </>
            )}
          </button>

          {/* Content with smooth expand/collapse */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
          >
            <div className="aui-rag-tool-content w-full text-foreground">
              <div className="rag-tool prose prose-base max-w-none dark:prose-invert text-foreground/90">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                >
                  {textContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        {/* Source References Footer - Enhanced Design */}
        {sources && sources.length > 0 && (
          <div className="border-t border-border/40 bg-gradient-to-r from-muted/20 to-transparent px-6 py-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpenIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  References
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.map((source, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1.5 rounded-lg border bg-gradient-to-r px-3 py-1.5 text-xs font-medium shadow-sm transition-transform hover:scale-[1.02] ${sourceBadgeColors[idx % sourceBadgeColors.length]}`}
                  >
                    <FileTextIcon className="h-3 w-3 opacity-70" />
                    {formatSourceName(source)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RAGTool;
