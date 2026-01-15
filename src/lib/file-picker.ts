/**
 * 文件选择工具
 * 封装 Tauri 的文件对话框 API
 */

import { isTauriEnv } from "@/services/api";

export interface FilePickerOptions {
  /** 对话框标题 */
  title?: string;
  /** 允许的文件扩展名 */
  extensions?: string[];
  /** 是否允许多选 */
  multiple?: boolean;
}

export interface FilePickerResult {
  /** 文件路径 */
  path: string;
  /** 文件名 */
  name: string;
}

/**
 * 打开文件选择对话框
 * @returns 选中的文件路径，取消则返回 null
 */
export async function pickFile(
  options: FilePickerOptions = {}
): Promise<FilePickerResult | null> {
  const { title = "选择文件", extensions, multiple = false } = options;

  if (!isTauriEnv()) {
    // 非 Tauri 环境使用浏览器的 file input
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = multiple;
      
      if (extensions && extensions.length > 0) {
        input.accept = extensions.map((ext) => `.${ext}`).join(",");
      }

      // 标记是否已处理
      let handled = false;

      input.onchange = () => {
        if (handled) return;
        handled = true;
        
        const file = input.files?.[0];
        if (file) {
          // 在浏览器环境中，我们可以创建一个 blob URL
          const url = URL.createObjectURL(file);
          resolve({
            path: url,
            name: file.name,
          });
        } else {
          resolve(null);
        }
      };

      // oncancel 在一些浏览器中不支持，使用 focus 事件作为备选
      input.oncancel = () => {
        if (handled) return;
        handled = true;
        resolve(null);
      };

      // 监听 focus 事件作为取消的备选检测
      // 当用户关闭文件对话框后，窗口会重新获得焦点
      const handleFocus = () => {
        // 延迟检查，给 onchange 事件时间触发
        setTimeout(() => {
          if (!handled) {
            handled = true;
            resolve(null);
          }
          window.removeEventListener("focus", handleFocus);
        }, 300);
      };

      // 延迟添加 focus 监听器，避免立即触发
      setTimeout(() => {
        window.addEventListener("focus", handleFocus);
      }, 100);

      input.click();
    });
  }

  try {
    // 动态导入 Tauri dialog
    const { open } = await import("@tauri-apps/plugin-dialog");
    
    const filters = extensions && extensions.length > 0
      ? [{ name: "支持的文件", extensions }]
      : undefined;

    const selected = await open({
      multiple: false,
      title,
      filters,
    });

    if (selected && typeof selected === "string") {
      // 从路径中提取文件名
      const name = selected.split(/[/\\]/).pop() || selected;
      return {
        path: selected,
        name,
      };
    }

    return null;
  } catch (err) {
    console.error("Failed to open file dialog:", err);
    return null;
  }
}

/**
 * 选择可阅读的电子书文件
 * 支持：EPUB, MOBI, AZW3, FB2, CBZ, PDF
 */
export async function pickReadableFile(): Promise<FilePickerResult | null> {
  return pickFile({
    title: "选择电子书文件",
    extensions: ["epub", "mobi", "azw3", "azw", "fb2", "cbz", "cbr", "pdf"],
  });
}

/**
 * 选择图片文件
 */
export async function pickImageFile(): Promise<FilePickerResult | null> {
  return pickFile({
    title: "选择图片",
    extensions: ["png", "jpg", "jpeg", "gif", "webp"],
  });
}

