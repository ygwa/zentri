/**
 * TipTap 编辑器内容生成工具
 * 用于生成符合 TipTap JSON 格式的内容
 */

import type { EditorContent, EditorNode } from "@/types";

/**
 * 创建空文档
 */
export function createEmptyDoc(): EditorContent {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

/**
 * 创建包含引用块的文档
 * @param quote 引用的文本
 * @param pageInfo 可选的页码信息
 */
export function createQuoteDoc(quote: string, pageInfo?: string): EditorContent {
  const content: EditorNode[] = [
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: quote }],
        },
      ],
    },
    { type: "paragraph" }, // 空行，方便用户继续编辑
  ];

  // 如果有页码信息，添加到引用块后
  if (pageInfo) {
    content.splice(1, 0, {
      type: "paragraph",
      content: [
        { type: "text", text: pageInfo },
      ],
    });
  }

  return {
    type: "doc",
    content,
  };
}

/**
 * 向现有内容追加引用块
 * @param existingContent 现有内容
 * @param quote 要追加的引用文本
 */
export function appendQuoteToContent(
  existingContent: EditorContent | string | null | undefined,
  quote: string
): EditorContent {
  // 解析现有内容
  let doc: EditorContent;
  
  if (!existingContent) {
    doc = createEmptyDoc();
  } else if (typeof existingContent === "string") {
    try {
      const parsed = JSON.parse(existingContent);
      if (parsed.type === "doc") {
        doc = parsed;
      } else {
        doc = createEmptyDoc();
      }
    } catch {
      // 如果是旧的 Markdown 格式，创建新文档
      doc = createEmptyDoc();
    }
  } else {
    doc = { ...existingContent };
  }

  // 确保 content 数组存在
  if (!doc.content) {
    doc.content = [];
  }

  // 添加空行和引用块
  doc.content = [
    ...doc.content,
    { type: "paragraph" },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: quote }],
        },
      ],
    },
    { type: "paragraph" }
  ];

  return doc;
}

