import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  ZoomIn,
  ZoomOut,
  Trash2,
  Maximize2,
  RotateCw,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageToolbarProps {
  editor: Editor;
}

interface ToolbarButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}

function ToolbarButton({ onClick, children, title, disabled }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded-md transition-all duration-150",
        "hover:bg-muted text-foreground/80 hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border/50 mx-0.5" />;
}

export function ImageToolbar({ editor }: ImageToolbarProps) {
  // 获取当前选中的图片节点
  const getSelectedImage = useCallback(() => {
    const { selection } = editor.state;
    const { $anchor } = selection;
    
    // 检查是否是节点选择（选中整个节点，如点击图片）
    if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
      return { node: selection.node, pos: selection.from };
    }
    
    // 检查当前节点是否是图片
    const node = $anchor.node();
    if (node && node.type.name === 'image') {
      return { node, pos: $anchor.pos };
    }
    
    // 检查父节点是否是图片
    const parent = $anchor.parent;
    if (parent && parent.type.name === 'image') {
      return { node: parent, pos: $anchor.before($anchor.depth) };
    }
    
    // 遍历文档查找图片节点
    let imageNode = null;
    let imagePos = 0;
    editor.state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'image') {
        imageNode = node;
        imagePos = pos;
        return false; // 停止遍历
      }
    });
    
    if (imageNode) {
      return { node: imageNode, pos: imagePos };
    }
    
    return null;
  }, [editor]);

  // 获取图片当前宽度
  const getImageWidth = useCallback(() => {
    const image = getSelectedImage();
    if (!image) return null;
    return image.node.attrs.width || null;
  }, [getSelectedImage]);

  // 设置图片宽度
  const setImageWidth = useCallback((width: number | null) => {
    const image = getSelectedImage();
    if (!image) return;

    const { pos } = image;
    const { tr } = editor.state;
    
    // 更新图片属性
    const attrs = { ...image.node.attrs };
    if (width === null) {
      delete attrs.width;
    } else {
      attrs.width = Math.max(50, Math.min(2000, width)); // 限制在 50-2000px
    }

    tr.setNodeMarkup(pos, undefined, attrs);
    editor.view.dispatch(tr);
  }, [editor, getSelectedImage]);

  // 放大图片（增加 10%）
  const zoomIn = useCallback(() => {
    const currentWidth = getImageWidth();
    if (currentWidth === null) {
      // 如果没有设置宽度，默认设置为 600px
      setImageWidth(600);
    } else {
      setImageWidth(Math.round(currentWidth * 1.1));
    }
  }, [getImageWidth, setImageWidth]);

  // 缩小图片（减少 10%）
  const zoomOut = useCallback(() => {
    const currentWidth = getImageWidth();
    if (currentWidth === null) {
      // 如果没有设置宽度，默认设置为 400px
      setImageWidth(400);
    } else {
      setImageWidth(Math.round(currentWidth * 0.9));
    }
  }, [getImageWidth, setImageWidth]);

  // 重置图片大小（移除宽度限制）
  const resetSize = useCallback(() => {
    setImageWidth(null);
  }, [setImageWidth]);

  // 删除图片
  const deleteImage = useCallback(() => {
    const image = getSelectedImage();
    if (!image) return;

    editor
      .chain()
      .focus()
      .deleteRange({ from: image.pos, to: image.pos + image.node.nodeSize })
      .run();
  }, [editor, getSelectedImage]);

  // 旋转图片（90度）
  const rotateImage = useCallback(() => {
    const image = getSelectedImage();
    if (!image) return;

    const { pos } = image;
    const { tr } = editor.state;
    
    const attrs = { ...image.node.attrs };
    const currentRotation = attrs.rotation || 0;
    attrs.rotation = (currentRotation + 90) % 360;

    tr.setNodeMarkup(pos, undefined, attrs);
    editor.view.dispatch(tr);
  }, [editor, getSelectedImage]);

  // 下载图片
  const downloadImage = useCallback(() => {
    const image = getSelectedImage();
    if (!image) return;

    const src = image.node.attrs.src;
    if (!src) return;

    // 创建临时链接下载图片
    const link = document.createElement('a');
    link.href = src;
    link.download = image.node.attrs.alt || 'image';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [getSelectedImage]);

  const currentWidth = getImageWidth();

  return (
    <div className="flex items-center gap-0.5 bg-popover/95 backdrop-blur-sm border rounded-xl shadow-xl px-1.5 py-1 animate-in fade-in-0 zoom-in-95 duration-150">
      {/* 缩放 */}
      <ToolbarButton
        onClick={zoomOut}
        title="缩小 (10%)"
      >
        <ZoomOut className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={zoomIn}
        title="放大 (10%)"
      >
        <ZoomIn className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* 重置大小 */}
      <ToolbarButton
        onClick={resetSize}
        title="重置大小"
      >
        <Maximize2 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* 旋转 */}
      <ToolbarButton
        onClick={rotateImage}
        title="旋转 90°"
      >
        <RotateCw className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* 下载 */}
      <ToolbarButton
        onClick={downloadImage}
        title="下载图片"
      >
        <Download className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {/* 删除 */}
      <ToolbarButton
        onClick={deleteImage}
        title="删除图片"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </ToolbarButton>

      {/* 显示当前宽度 */}
      {currentWidth !== null && (
        <>
          <Divider />
          <div className="px-2 text-xs text-muted-foreground">
            {currentWidth}px
          </div>
        </>
      )}
    </div>
  );
}

