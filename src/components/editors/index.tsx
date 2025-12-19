/**
 * 编辑器组件集合
 * 
 * 提供三种不同场景的编辑器：
 * 1. FlashNoteEditor - 弹框编辑器，用于快速记录闪念笔记
 * 2. CardNoteEditor - 卡片笔记编辑器，固定大小，限制内容量
 * 3. ProjectNoteEditor - 项目笔记编辑器，A4纸模式，引导深度思考
 */

export { FlashNoteEditor } from "./flash-note-editor";
export type { FlashNoteEditorProps } from "./flash-note-editor";

export { CardNoteEditor } from "./card-note-editor";
export type { CardNoteEditorProps } from "./card-note-editor";

export { ProjectNoteEditor } from "./project-note-editor";
export type { ProjectNoteEditorProps } from "./project-note-editor";

