/**
 * 资源文件 API
 * 处理图片等资源文件的上传、保存和管理
 */

import { invoke } from "@tauri-apps/api/core";
import { getFileUrl } from "@/lib/file-url";

/**
 * 保存图片文件到 vault
 * @param imageData 图片的二进制数据
 * @param filename 原始文件名
 * @returns 相对于 vault 的路径
 */
export async function saveImage(
  imageData: Uint8Array,
  filename: string
): Promise<string> {
  return await invoke<string>("save_image", {
    imageData: Array.from(imageData),
    filename,
  });
}

/**
 * 读取图片文件
 * @param relativePath 相对于 vault 的路径
 * @returns 图片的二进制数据
 */
export async function readImage(relativePath: string): Promise<Uint8Array> {
  const data = await invoke<number[]>("read_image", { relativePath });
  return new Uint8Array(data);
}

/**
 * 删除图片文件
 * @param relativePath 相对于 vault 的路径
 */
export async function deleteImage(relativePath: string): Promise<void> {
  await invoke<void>("delete_image", { relativePath });
}

/**
 * 获取图片的访问 URL
 * @param relativePath 相对于 vault 的路径
 * @returns 可访问的 URL
 */
export async function getImageUrl(relativePath: string): Promise<string> {
  // 获取 vault 路径并构建完整路径
  const { getPath } = await import("./vault");
  const vaultPath = await getPath();
  
  if (!vaultPath) {
    throw new Error("Vault not initialized");
  }

  // 构建完整路径
  const fullPath = `${vaultPath}/${relativePath}`;
  
  // 转换为可访问的 URL
  return await getFileUrl(fullPath);
}

/**
 * 保存电子书文件到 vault 的 assets/books 目录
 * @param sourcePath 源文件路径（本地文件路径）
 * @param filename 原始文件名
 * @returns 相对于 vault 的路径
 */
export async function saveBookFile(
  sourcePath: string,
  filename: string
): Promise<string> {
  return await invoke<string>("save_book_file", {
    sourcePath,
    filename,
  });
}

/**
 * 获取电子书文件的访问 URL（用于流式读取）
 * @param relativePath 相对于 vault 的路径
 * @returns 可访问的 URL（绝对路径，需要转换为 asset:// URL）
 */
export async function getBookFileUrl(relativePath: string): Promise<string> {
  const filePath = await invoke<string>("get_book_file_url", { relativePath });
  // 转换为可访问的 URL
  return await getFileUrl(filePath);
}

