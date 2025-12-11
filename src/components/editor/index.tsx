/**
 * Zentri 编辑器 - 基于 TipTap 的富文本编辑器
 * 
 * 特性：
 * - 使用 TipTap JSON 格式存储，无损保存所有格式
 * - / 斜杠命令菜单
 * - [[ 双链自动补全
 * - Bubble 工具栏（选中文字时显示）
 * - 丰富的块类型支持
 * - 代码高亮
 * - 任务列表
 * - 表格支持
 */
export { ZentriEditor } from "./zentri-editor";
export type { ZentriEditorProps } from "./zentri-editor";

export { LinkAutocomplete } from "./link-autocomplete";
export type { CardSuggestion } from "./link-autocomplete";

// WikiLink 相关工具函数
export { extractWikiLinkTitles, resolveWikiLinksToIds } from "./extensions/wiki-link";

// Re-export JSONContent type for convenience
export type { JSONContent } from "@tiptap/react";
