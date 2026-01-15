/**
 * 图片处理工具
 * 处理图片文件的选择、保存和插入
 */

import { pickImageFile } from "./file-picker";
import { assets } from "@/services/api";
import { getFileUrl } from "./file-url";
import { isTauriEnv } from "@/services/api";

/**
 * 从文件选择器选择图片并保存
 * @returns 图片的相对路径（相对于 vault）
 */
export async function selectAndSaveImage(): Promise<string | null> {
  try {
    // 选择图片文件
    const fileResult = await pickImageFile();
    if (!fileResult) {
      return null;
    }

    // 读取文件数据
    let imageData: Uint8Array;
    let filename: string;

    if (isTauriEnv()) {
      // Tauri 环境：使用后端命令读取文件
      try {
        // 先尝试使用后端读取（如果文件已经在 vault 中）
        // 否则，我们需要通过 invoke 读取本地文件
        const { invoke } = await import("@tauri-apps/api/core");
        const data = await invoke<number[]>("read_image", { 
          relativePath: fileResult.path 
        }).catch(() => {
          // 如果失败，说明文件不在 vault 中，需要先读取本地文件
          // 这种情况下，我们需要使用 Rust 命令来读取本地文件
          // 暂时返回 null，让用户知道需要先将文件复制到 vault
          return null;
        });
        
        if (data) {
          imageData = new Uint8Array(data);
          filename = fileResult.name;
        } else {
          // 文件不在 vault 中，需要先读取本地文件
          // 使用 Rust 后端读取本地文件并保存
          const { invoke } = await import("@tauri-apps/api/core");
          const localData = await invoke<number[]>("read_local_file", {
            path: fileResult.path,
          });
          imageData = new Uint8Array(localData);
          filename = fileResult.name;
        }
      } catch (error) {
        // 如果后端命令不存在，回退到前端读取
        // 但这种情况不应该发生，因为我们已经实现了后端命令
        console.error("Failed to read file via backend:", error);
        throw error;
      }
    } else {
      // 浏览器环境：从 blob URL 读取
      const response = await fetch(fileResult.path);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      imageData = new Uint8Array(arrayBuffer);
      filename = fileResult.name;
    }

    // 保存到 vault
    const relativePath = await assets.saveImage(imageData, filename);
    return relativePath;
  } catch (error) {
    console.error("Failed to select and save image:", error);
    return null;
  }
}

/**
 * 从 File 对象保存图片
 * @param file 图片文件对象
 * @returns 图片的相对路径（相对于 vault）
 */
export async function saveImageFromFile(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const imageData = new Uint8Array(arrayBuffer);
    const relativePath = await assets.saveImage(imageData, file.name);
    return relativePath;
  } catch (error) {
    console.error("Failed to save image from file:", error);
    return null;
  }
}

/**
 * 获取图片的访问 URL
 * @param relativePath 相对于 vault 的路径
 * @returns 可访问的 URL
 */
export async function getImageUrl(relativePath: string): Promise<string> {
  // 获取 vault 路径并构建完整路径
  const { vault } = await import("@/services/api");
  const vaultPath = await vault.getPath();
  
  if (!vaultPath) {
    throw new Error("Vault not initialized");
  }

  // 构建完整路径（处理路径分隔符和前导斜杠）
  // relativePath 可能是 "assets/xxx.png" 或 "/assets/xxx.png" 或 "assets\\xxx.png"
  let normalizedRelative = relativePath.replace(/\\/g, '/');
  // 移除前导斜杠（如果有）
  if (normalizedRelative.startsWith('/')) {
    normalizedRelative = normalizedRelative.slice(1);
  }
  
  // 确保 vaultPath 不以斜杠结尾，relativePath 不以斜杠开头
  const vaultPathNormalized = vaultPath.replace(/[/\\]+$/, '');
  const fullPath = `${vaultPathNormalized}/${normalizedRelative}`;
  
  console.log("[Image] Vault path:", vaultPath);
  console.log("[Image] Relative path:", relativePath);
  console.log("[Image] Normalized relative:", normalizedRelative);
  console.log("[Image] Full path:", fullPath);
  
  // 转换为可访问的 URL
  const url = await getFileUrl(fullPath);
  console.log("[Image] Converted URL:", url);
  console.log("[Image] URL starts with:", {
    'http': url.startsWith('http'),
    'asset': url.startsWith('asset://'),
    'tauri': url.startsWith('tauri://'),
    'http://asset.localhost': url.startsWith('http://asset.localhost'),
  });
  
  // 验证 URL 格式
  if (!url || (!url.startsWith('http') && !url.startsWith('asset://') && !url.startsWith('tauri://'))) {
    console.warn("[Image] URL format may be incorrect:", url);
    // 尝试使用 Base64 作为备选方案
    try {
      const { assets } = await import("@/services/api");
      const imageData = await assets.readImage(relativePath);
      const base64 = btoa(String.fromCharCode(...imageData));
      const dataUrl = `data:image/png;base64,${base64}`;
      console.log("[Image] Using Base64 fallback, length:", dataUrl.length);
      return dataUrl;
    } catch (err) {
      console.error("[Image] Failed to create Base64 fallback:", err);
      throw new Error(`Invalid image URL: ${url}`);
    }
  }
  
  return url;
}

