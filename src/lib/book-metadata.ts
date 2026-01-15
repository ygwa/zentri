/**
 * 书籍元数据解析工具
 * 从 EPUB/PDF 文件中提取标题、作者、封面等信息
 */

import ePub, { Book } from "epubjs";
import { getFileUrl } from "./file-url";

export interface BookMetadata {
  title?: string;
  author?: string;
  publisher?: string;
  description?: string;
  language?: string;
  coverUrl?: string;     // 封面图片的 data URL
  publishDate?: string;
  isbn?: string;
  pageCount?: number;
}

/**
 * 从 EPUB 文件解析元数据
 */
export async function parseEpubMetadata(filePath: string): Promise<BookMetadata> {
  const metadata: BookMetadata = {};
  
  try {
    let arrayBuffer: ArrayBuffer;
    
    // 检查是否是相对路径（assets/books/...）
    const isRelativePath = filePath && 
      !filePath.startsWith("http") && 
      !filePath.startsWith("asset://") && 
      !filePath.startsWith("file://") && 
      !filePath.startsWith("/") &&
      !filePath.startsWith("tauri://") &&
      !filePath.startsWith("blob:");
    
    if (isRelativePath) {
      // 相对路径，使用 Rust 后端读取文件
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { isTauriEnv } = await import("@/services/api");
        
        if (isTauriEnv()) {
          const fileData = await invoke<number[]>("read_book_file", { relativePath: filePath });
          arrayBuffer = new Uint8Array(fileData).buffer;
        } else {
          throw new Error("Relative path not supported in browser environment");
        }
      } catch (err) {
        console.error("Failed to read file from Rust backend:", err);
        throw new Error(`Failed to load EPUB file: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      // 绝对路径或 URL，通过 fetch 获取
      const fileUrl = await getFileUrl(filePath);
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      arrayBuffer = await response.arrayBuffer();
    }
    
    // 创建 EPUB 实例
    const book: Book = ePub(arrayBuffer);
    await book.ready;
    
    // 获取元数据
    const bookMetadata = book.packaging?.metadata;
    if (bookMetadata) {
      metadata.title = bookMetadata.title || undefined;
      metadata.author = bookMetadata.creator || undefined;
      metadata.publisher = bookMetadata.publisher || undefined;
      metadata.description = bookMetadata.description || undefined;
      metadata.language = bookMetadata.language || undefined;
      
      // 解析发布日期
      if (bookMetadata.pubdate) {
        metadata.publishDate = bookMetadata.pubdate;
      }
      
      // 解析 ISBN (可能在 identifier 中)
      if (bookMetadata.identifier) {
        const isbn = bookMetadata.identifier.match(/(?:97[89])?[\d-]{10,17}/);
        if (isbn) {
          metadata.isbn = isbn[0].replace(/-/g, '');
        }
      }
    }
    
    // 获取封面图片
    try {
      const coverUrl = await book.coverUrl();
      if (coverUrl) {
        try {
          // 将封面转换为 data URL 以便存储
          const coverResponse = await fetch(coverUrl);
          if (coverResponse.ok) {
            const coverBlob = await coverResponse.blob();
            metadata.coverUrl = await blobToDataUrl(coverBlob);
          } else {
            console.warn("Failed to fetch cover image:", coverResponse.status);
          }
        } catch (fetchErr) {
          // 如果 fetch 失败，尝试使用 book.archive 直接获取封面
          console.warn("Failed to fetch cover URL, trying alternative method:", fetchErr);
          try {
            // epubjs 的 coverUrl 可能返回一个需要特殊处理的 URL
            // 尝试直接从 archive 获取封面
            const cover = await (book.archive as any).get(coverUrl);
            if (cover) {
              const coverBlob = new Blob([cover], { type: 'image/jpeg' });
              metadata.coverUrl = await blobToDataUrl(coverBlob);
            }
          } catch (archiveErr) {
            console.warn("Failed to get cover from archive:", archiveErr);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to extract cover image:", e);
    }
    
    // 清理
    book.destroy();
    
  } catch (error) {
    console.error("Failed to parse EPUB metadata:", error);
    throw error;
  }
  
  return metadata;
}

/**
 * 从 PDF 文件解析元数据（基础实现）
 * PDF 解析比较复杂，这里只提取文件名作为标题
 * 完整的 PDF 元数据解析需要使用 pdf.js 或后端实现
 */
export async function parsePdfMetadata(filePath: string): Promise<BookMetadata> {
  const metadata: BookMetadata = {};
  
  // 从文件路径提取文件名作为标题
  const fileName = filePath.split(/[/\\]/).pop() || '';
  const titleFromName = fileName.replace(/\.pdf$/i, '');
  
  metadata.title = titleFromName;
  
  // TODO: 使用 pdf.js 或后端解析完整 PDF 元数据
  // 包括：作者、创建日期、页数等
  
  return metadata;
}

/**
 * 根据文件类型解析元数据
 */
export async function parseBookMetadata(filePath: string): Promise<BookMetadata> {
  const lowerPath = filePath.toLowerCase();
  
  if (lowerPath.endsWith('.epub')) {
    return parseEpubMetadata(filePath);
  } else if (lowerPath.endsWith('.pdf')) {
    return parsePdfMetadata(filePath);
  }
  
  // 未知格式，返回空元数据
  return {};
}

/**
 * 将 Blob 转换为 Data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 生成基于标题的占位封面（当没有真实封面时使用）
 * 返回一个带有书名首字和渐变背景的 SVG Data URL
 */
export function generatePlaceholderCover(title: string, type: 'book' | 'paper' = 'book'): string {
  // 获取标题首字
  const firstChar = title.trim().charAt(0).toUpperCase() || '?';
  
  // 根据标题生成伪随机颜色
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // 预设的专业配色方案
  const colorSchemes = [
    { from: '#1e3a5f', to: '#2d5a87' },  // 深蓝
    { from: '#1f4037', to: '#99f2c8' },  // 绿色渐变
    { from: '#373b44', to: '#4286f4' },  // 灰蓝
    { from: '#614385', to: '#516395' },  // 紫色
    { from: '#c94b4b', to: '#4b134f' },  // 红紫
    { from: '#134e5e', to: '#71b280' },  // 青绿
    { from: '#0f2027', to: '#203a43' },  // 深灰蓝
    { from: '#4a00e0', to: '#8e2de2' },  // 紫罗兰
  ];
  
  const scheme = colorSchemes[hash % colorSchemes.length];
  
  // 书籍图标路径
  const bookIcon = type === 'book' 
    ? `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
       <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    : `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
       <path d="M14 2v6h6" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${scheme.from}"/>
          <stop offset="100%" style="stop-color:${scheme.to}"/>
        </linearGradient>
      </defs>
      <rect width="120" height="160" fill="url(#bg)" rx="4"/>
      <g transform="translate(48, 20) scale(1)">
        ${bookIcon}
      </g>
      <text x="60" y="100" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="48" 
        font-weight="600" 
        fill="rgba(255,255,255,0.9)" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >${firstChar}</text>
      <text x="60" y="140" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="8" 
        fill="rgba(255,255,255,0.5)" 
        text-anchor="middle"
      >ZENTRI</text>
    </svg>
  `.trim();
  
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}






