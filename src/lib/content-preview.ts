/**
 * 内容预览工具
 * 将编辑器内容（JSON 或字符串）转换为纯文本预览
 */

import React from "react";
import type { EditorContent, EditorNode } from "@/types";

/**
 * 从编辑器内容中提取纯文本预览
 * 支持 JSON 格式和旧的 HTML/Markdown 字符串格式
 */
export function getContentPreview(content: EditorContent | string | null | undefined, maxLength: number = 100): string {
  if (!content) return "暂无内容";

  // 如果是 JSON 格式，从节点中提取文本
  if (typeof content === "object" && content.type === "doc") {
    const text = extractTextFromNodes(content.content || []);
    if (!text.trim()) return "暂无内容";
    
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length > maxLength) {
      return cleaned.slice(0, maxLength) + "...";
    }
    return cleaned;
  }

  // 旧的字符串格式处理
  if (typeof content !== "string") return "暂无内容";
  
  const htmlContent = content;
  if (htmlContent.trim() === "") return "暂无内容";

  let text = htmlContent;

  // 1. 处理 wiki links: 转换为超链接样式
  text = text.replace(
    /<span[^>]*data-type="wiki-link"[^>]*data-href="([^"]+)"[^>]*data-title="([^"]*)"[^>]*>([^<]*)<\/span>/gi,
    (_match, href, title, displayText) => {
      const linkTitle = displayText.trim() || title || href;
      return `→ ${linkTitle}`;
    }
  );

  // 2. 处理 [[title|id]] 格式的 wiki links
  text = text.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, title) => {
      return `→ ${title.trim()}`;
    }
  );

  // 3. 移除所有 HTML 标签
  text = text.replace(/<[^>]+>/g, "");

  // 4. 解码 HTML 实体
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // 5. 清理多余的空格和换行
  text = text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .trim();

  // 6. 截断到指定长度
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + "...";
  }

  return text || "暂无内容";
}

/**
 * 从 TipTap JSON 节点中递归提取纯文本
 */
function extractTextFromNodes(nodes: EditorNode[]): string {
  let text = "";
  
  for (const node of nodes) {
    // 如果节点有 text 属性，直接使用
    if (node.text) {
      text += node.text;
    }
    
    // 处理 wiki-link 节点
    if (node.type === "wikiLink" && node.attrs) {
      const title = (node.attrs.title as string) || (node.attrs.href as string) || "";
      text += `→ ${title}`;
    }
    
    // 递归处理子节点
    if (node.content && Array.isArray(node.content)) {
      text += extractTextFromNodes(node.content);
    }
    
    // 在块级元素后添加空格
    if (["paragraph", "heading", "listItem", "blockquote"].includes(node.type)) {
      text += " ";
    }
  }
  
  return text;
}

/**
 * 渲染内容预览，支持 wiki links 的点击
 * 返回 React 元素
 */
export function renderContentPreview(
  content: EditorContent | string | null | undefined,
  maxLength: number = 100,
  onLinkClick?: (id: string) => void
): React.ReactNode {
  if (!content) return "暂无内容";

  // 如果是 JSON 格式
  if (typeof content === "object" && content.type === "doc") {
    const parts = extractPartsFromNodes(content.content || []);
    
    if (parts.length === 0) return "暂无内容";
    
    // 渲染带链接的预览
    return renderParts(parts, maxLength, onLinkClick);
  }

  // 旧的字符串格式处理
  if (typeof content !== "string") return "暂无内容";
  
  const htmlContent = content;
  if (htmlContent.trim() === "") return "暂无内容";

  let text = htmlContent;
  const parts: Array<{ type: "text" | "link"; content: string; id?: string }> = [];

  // 1. 提取 wiki links
  const wikiLinkRegex = /<span[^>]*data-type="wiki-link"[^>]*data-href="([^"]+)"[^>]*data-title="([^"]*)"[^>]*>([^<]*)<\/span>/gi;
  let lastIndex = 0;
  let match;

  while ((match = wikiLinkRegex.exec(text)) !== null) {
    const beforeText = text.slice(lastIndex, match.index);
    if (beforeText) {
      const cleanText = stripHtml(beforeText);
      if (cleanText) {
        parts.push({ type: "text", content: cleanText });
      }
    }

    const href = match[1];
    const title = match[3]?.trim() || match[2] || href;
    parts.push({ type: "link", content: title, id: href });

    lastIndex = match.index + match[0].length;
  }

  const remainingText = text.slice(lastIndex);
  if (remainingText) {
    const cleanText = stripHtml(remainingText);
    if (cleanText) {
      parts.push({ type: "text", content: cleanText });
    }
  }

  // 如果没有找到 HTML 格式的链接，尝试 [[title|id]] 格式
  if (parts.length === 0 || parts.every(p => p.type === "text")) {
    const markdownLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let mdLastIndex = 0;
    let mdMatch;
    const mdParts: Array<{ type: "text" | "link"; content: string; id?: string }> = [];

    while ((mdMatch = markdownLinkRegex.exec(text)) !== null) {
      const beforeText = text.slice(mdLastIndex, mdMatch.index);
      if (beforeText) {
        const cleanText = stripHtml(beforeText);
        if (cleanText) {
          mdParts.push({ type: "text", content: cleanText });
        }
      }

      const title = mdMatch[1].trim();
      const id = mdMatch[2]?.trim() || title;
      mdParts.push({ type: "link", content: title, id: id });

      mdLastIndex = mdMatch.index + mdMatch[0].length;
    }

    const mdRemainingText = text.slice(mdLastIndex);
    if (mdRemainingText) {
      const cleanText = stripHtml(mdRemainingText);
      if (cleanText) {
        mdParts.push({ type: "text", content: cleanText });
      }
    }

    if (mdParts.length > 0 && mdParts.some(p => p.type === "link")) {
      parts.length = 0;
      parts.push(...mdParts);
    }
  }

  if (parts.length === 0 || parts.every(p => p.type === "text")) {
    return getContentPreview(htmlContent, maxLength);
  }

  return renderParts(parts, maxLength, onLinkClick);
}

/**
 * 从 TipTap JSON 节点中提取文本和链接部分
 */
function extractPartsFromNodes(nodes: EditorNode[]): Array<{ type: "text" | "link"; content: string; id?: string }> {
  const parts: Array<{ type: "text" | "link"; content: string; id?: string }> = [];
  
  for (const node of nodes) {
    // 如果节点有 text 属性
    if (node.text) {
      parts.push({ type: "text", content: node.text });
    }
    
    // 处理 wiki-link 节点
    if (node.type === "wikiLink" && node.attrs) {
      const title = (node.attrs.title as string) || "";
      const href = (node.attrs.href as string) || "";
      parts.push({ type: "link", content: title || href, id: href });
    }
    
    // 递归处理子节点
    if (node.content && Array.isArray(node.content)) {
      parts.push(...extractPartsFromNodes(node.content));
    }
    
    // 在块级元素后添加空格
    if (["paragraph", "heading", "listItem", "blockquote"].includes(node.type)) {
      parts.push({ type: "text", content: " " });
    }
  }
  
  return parts;
}

/**
 * 渲染文本和链接部分
 */
function renderParts(
  parts: Array<{ type: "text" | "link"; content: string; id?: string }>,
  maxLength: number,
  onLinkClick?: (id: string) => void
): React.ReactNode {
  let totalLength = 0;
  const result: React.ReactNode[] = [];

  for (const part of parts) {
    if (totalLength >= maxLength) break;

    if (part.type === "text") {
      const remaining = maxLength - totalLength;
      if (part.content.length > remaining) {
        result.push(part.content.slice(0, remaining) + "...");
        break;
      }
      result.push(part.content);
      totalLength += part.content.length;
    } else {
      const linkText = `→ ${part.content}`;
      if (totalLength + linkText.length > maxLength) {
        result.push("...");
        break;
      }
      result.push(
        React.createElement(
          "span",
          {
            key: `link-${part.id}-${totalLength}`,
            className: "text-primary hover:underline cursor-pointer inline-flex items-center gap-0.5",
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              onLinkClick?.(part.id!);
            },
          },
          "→ ",
          part.content
        )
      );
      totalLength += linkText.length;
    }
  }

  return React.createElement(React.Fragment, null, ...result);
}

/**
 * 移除 HTML 标签，返回纯文本
 */
function stripHtml(html: string): string {
  let text = html;

  text = text.replace(/<[^>]+>/g, "");

  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  text = text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .trim();

  return text;
}
