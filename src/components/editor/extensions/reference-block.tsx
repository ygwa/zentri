import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Quote, MapPin, MessageSquare, BookOpen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReferenceBlockOptions {
  onLocate?: (sourceId: string, location: { page?: number; cfi?: string }) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    referenceBlock: {
      setReferenceBlock: (attributes: { 
        sourceId: string; 
        sourceTitle?: string;
        quoteContent: string; 
        page?: number; 
        cfi?: string; 
        sourceType?: string;
        comment?: string 
      }) => ReturnType;
    };
  }
}

// React Component for the Node View
const ReferenceBlockComponent = ({ node, extension }: { 
  node: { attrs: Record<string, unknown> };
  extension: { options: ReferenceBlockOptions };
}) => {
  const { sourceId, sourceTitle, quoteContent, page, cfi, sourceType, comment } = node.attrs as {
    sourceId: string;
    sourceTitle?: string;
    quoteContent: string;
    page?: number;
    cfi?: string;
    sourceType?: string;
    comment?: string;
  };
  const { onLocate } = extension.options;
  
  const SourceIcon = sourceType === "epub" ? BookOpen : FileText;

  return (
    <NodeViewWrapper className="reference-block my-4">
      <div className="rounded-lg border bg-gradient-to-b from-muted/20 to-muted/40 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Quote Content */}
        <div className="p-4 border-l-4 border-amber-500 bg-background/80">
          <div className="flex gap-3">
            <Quote className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm italic text-foreground/90 font-serif leading-relaxed">
              {quoteContent}
            </div>
          </div>
        </div>

        {/* Source Info & Actions */}
        <div className="px-4 py-2 bg-muted/60 border-t flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <SourceIcon className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground/80 max-w-[150px] truncate">
                {sourceTitle || "来源文档"}
              </span>
            </div>
            {page && (
              <span className="flex items-center gap-1 text-muted-foreground">
                • P.{page}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs gap-1 hover:bg-amber-100 hover:text-amber-700"
              onClick={() => onLocate?.(sourceId, { page, cfi })}
            >
              <MapPin className="h-3 w-3" />
              跳转原文
            </Button>
          </div>
        </div>

        {/* Optional Comment */}
        {comment && (
          <div className="px-4 py-2 border-t bg-yellow-50/30 text-xs text-muted-foreground flex gap-2">
            <MessageSquare className="h-3 w-3 mt-0.5 text-yellow-600" />
            <span className="text-foreground/70">{comment}</span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ReferenceBlock = Node.create<ReferenceBlockOptions>({
  name: "referenceBlock",
  group: "block",
  atom: true, // It's an atomic block, content is not editable directly in standard way (attributes are)

  addOptions() {
    return {
      onLocate: undefined,
    };
  },

  addAttributes() {
    return {
      sourceId: { default: null },
      sourceTitle: { default: null },
      sourceType: { default: "pdf" }, // "pdf" or "epub"
      quoteContent: { default: "" },
      page: { default: null },
      cfi: { default: null }, // For EPUB
      comment: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="reference-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "reference-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ReferenceBlockComponent);
  },

  addCommands() {
    return {
      setReferenceBlock:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },
});

