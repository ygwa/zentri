import React from 'react';
import type { EditorContent, EditorNode } from '@/types';
import { cn } from '@/lib/utils';

interface ContentRendererProps {
  content: EditorContent | string | null | undefined;
  onLinkClick?: (id: string) => void;
  className?: string;
}

/**
 * 渲染格式化的编辑器内容
 * 支持标题、段落、列表、wiki links 等
 */
export function ContentRenderer({ content, onLinkClick, className }: ContentRendererProps) {
  if (!content) {
    return <div className={cn("text-zinc-400 text-sm", className)}>暂无内容</div>;
  }

  // 如果是 JSON 格式
  if (typeof content === "object" && content.type === "doc") {
    return (
      <div className={cn("prose prose-sm prose-zinc max-w-none", className)}>
        {renderNodes(content.content || [], onLinkClick)}
      </div>
    );
  }

  // 旧的字符串格式，返回纯文本
  if (typeof content === "string") {
    return <div className={cn("text-zinc-600 whitespace-pre-wrap", className)}>{content}</div>;
  }

  return null;
}

/**
 * 递归渲染节点
 */
function renderNodes(
  nodes: EditorNode[],
  onLinkClick?: (id: string) => void,
  keyPrefix: string = ""
): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (node.type) {
      case "paragraph":
        return (
          <p key={key} className="mb-2 last:mb-0">
            {renderInlineContent(node.content || [], onLinkClick, key)}
          </p>
        );

      case "heading":
        const level = (node.attrs?.level as number) || 1;
        const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
        const headingClasses = {
          1: "text-2xl font-bold mb-3 mt-4",
          2: "text-xl font-bold mb-2 mt-3",
          3: "text-lg font-bold mb-2 mt-2",
        }[level] || "text-base font-bold mb-2";
        return (
          <HeadingTag key={key} className={cn(headingClasses, "text-zinc-900")}>
            {renderInlineContent(node.content || [], onLinkClick, key)}
          </HeadingTag>
        );

      case "bulletList":
        return (
          <ul key={key} className="list-disc list-inside mb-2 space-y-1">
            {renderNodes(node.content || [], onLinkClick, key)}
          </ul>
        );

      case "orderedList":
        return (
          <ol key={key} className="list-decimal list-inside mb-2 space-y-1">
            {renderNodes(node.content || [], onLinkClick, key)}
          </ol>
        );

      case "listItem":
        return (
          <li key={key} className="text-zinc-700">
            {renderNodes(node.content || [], onLinkClick, key)}
          </li>
        );

      case "blockquote":
        return (
          <blockquote key={key} className="border-l-4 border-zinc-300 pl-4 italic my-2 text-zinc-600">
            {renderNodes(node.content || [], onLinkClick, key)}
          </blockquote>
        );

      case "codeBlock":
        const code = extractTextFromNode(node);
        return (
          <pre key={key} className="bg-zinc-100 rounded p-3 overflow-x-auto mb-2">
            <code className="text-sm font-mono text-zinc-800">{code}</code>
          </pre>
        );

      case "hardBreak":
        return <br key={key} />;

      default:
        // 对于其他节点类型，尝试渲染内联内容
        if (node.content) {
          return (
            <span key={key}>
              {renderInlineContent(node.content, onLinkClick, key)}
            </span>
          );
        }
        return null;
    }
  });
}

/**
 * 渲染内联内容（文本、链接、格式等）
 */
function renderInlineContent(
  nodes: EditorNode[],
  onLinkClick?: (id: string) => void,
  keyPrefix: string = ""
): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-inline-${index}`;

    // Wiki Link 节点
    if (node.type === "wikiLink") {
      const title = (node.attrs?.title as string) || "";
      const href = (node.attrs?.href as string) || "";
      const exists = node.attrs?.exists !== false;

      return (
        <span
          key={key}
          className={cn(
            "inline bg-blue-50 rounded px-1 py-0.5 text-sm font-medium cursor-pointer transition-all",
            exists
              ? "text-blue-600 hover:bg-blue-100"
              : "text-zinc-500 bg-zinc-50 opacity-70 hover:bg-zinc-100 hover:opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (href && onLinkClick) {
              onLinkClick(href);
            }
          }}
        >
          [[{title || href}]]
        </span>
      );
    }

    // 文本节点
    if (node.type === "text") {
      const text = node.text || "";
      const marks = node.marks || [];

      // 应用格式标记（从内到外）
      let element: React.ReactNode = text;
      
      // 按顺序应用标记
      for (const mark of marks) {
        switch (mark.type) {
          case "bold":
            element = <strong key={`${key}-bold`}>{element}</strong>;
            break;
          case "italic":
            element = <em key={`${key}-italic`}>{element}</em>;
            break;
          case "strike":
            element = <del key={`${key}-strike`}>{element}</del>;
            break;
          case "code":
            element = (
              <code key={`${key}-code`} className="bg-zinc-100 px-1 rounded text-xs font-mono">
                {element}
              </code>
            );
            break;
          case "link":
            const href = (mark.attrs?.href as string) || "";
            element = (
              <a
                key={`${key}-link`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {element}
              </a>
            );
            break;
        }
      }

      return <React.Fragment key={key}>{element}</React.Fragment>;
    }

    // 递归处理子节点
    if (node.content) {
      return (
        <React.Fragment key={key}>
          {renderInlineContent(node.content, onLinkClick, key)}
        </React.Fragment>
      );
    }

    return null;
  });
}

/**
 * 从节点中提取纯文本
 */
function extractTextFromNode(node: EditorNode): string {
  if (node.text) {
    return node.text;
  }
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join("");
  }
  return "";
}

