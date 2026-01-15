/**
 * 统一的阅读器错误处理工具
 */

export interface ReaderError {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
}

export const ReaderErrorCodes = {
  FILE_LOAD_FAILED: 'FILE_LOAD_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_FORMAT: 'INVALID_FORMAT',
  HIGHLIGHT_CREATE_FAILED: 'HIGHLIGHT_CREATE_FAILED',
  HIGHLIGHT_RESTORE_FAILED: 'HIGHLIGHT_RESTORE_FAILED',
  PROGRESS_RESTORE_FAILED: 'PROGRESS_RESTORE_FAILED',
  INVALID_POSITION_DATA: 'INVALID_POSITION_DATA',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export type ReaderErrorCode = typeof ReaderErrorCodes[keyof typeof ReaderErrorCodes];

/**
 * 创建阅读器错误对象
 */
export function createReaderError(
  code: ReaderErrorCode,
  details?: string
): ReaderError {
  const errorMap: Record<ReaderErrorCode, { message: string; userMessage: string; recoverable: boolean }> = {
    [ReaderErrorCodes.FILE_LOAD_FAILED]: {
      message: `Failed to load file: ${details || 'Unknown error'}`,
      userMessage: '无法加载文件。请检查文件是否存在且格式正确。',
      recoverable: true,
    },
    [ReaderErrorCodes.FILE_NOT_FOUND]: {
      message: `File not found: ${details || ''}`,
      userMessage: '文件未找到。文件可能已被移动或删除。',
      recoverable: true,
    },
    [ReaderErrorCodes.INVALID_FORMAT]: {
      message: `Invalid file format: ${details || ''}`,
      userMessage: '不支持的文件格式。请确保文件是 EPUB 或 PDF 格式。',
      recoverable: false,
    },
    [ReaderErrorCodes.HIGHLIGHT_CREATE_FAILED]: {
      message: `Failed to create highlight: ${details || 'Unknown error'}`,
      userMessage: '创建高亮失败。请重试。',
      recoverable: true,
    },
    [ReaderErrorCodes.HIGHLIGHT_RESTORE_FAILED]: {
      message: `Failed to restore highlight: ${details || 'Invalid position data'}`,
      userMessage: '部分高亮无法显示（位置数据无效）。高亮已保存，但可能无法正确显示。',
      recoverable: true,
    },
    [ReaderErrorCodes.PROGRESS_RESTORE_FAILED]: {
      message: `Failed to restore progress: ${details || 'Invalid progress data'}`,
      userMessage: '', // 不显示给用户，静默失败
      recoverable: true,
    },
    [ReaderErrorCodes.INVALID_POSITION_DATA]: {
      message: `Invalid position data: ${details || ''}`,
      userMessage: '位置数据无效。请重新选择文本。',
      recoverable: true,
    },
    [ReaderErrorCodes.PERMISSION_DENIED]: {
      message: `Permission denied: ${details || ''}`,
      userMessage: '没有权限访问此文件。请检查文件权限。',
      recoverable: true,
    },
  };

  const error = errorMap[code];
  return {
    code,
    message: error.message,
    userMessage: error.userMessage,
    recoverable: error.recoverable,
  };
}

/**
 * 显示错误消息给用户（使用 toast 或 alert）
 */
export function showReaderError(error: ReaderError): void {
  if (error.userMessage) {
    // TODO: 替换为 toast 通知系统
    console.error(`[Reader Error ${error.code}]: ${error.message}`);
    // 临时使用 alert，后续可以替换为 toast
    if (error.code !== ReaderErrorCodes.PROGRESS_RESTORE_FAILED) {
      alert(error.userMessage);
    }
  } else {
    // 静默错误，只记录日志
    console.warn(`[Reader Warning ${error.code}]: ${error.message}`);
  }
}

/**
 * 验证位置数据的完整性
 */
export function validatePositionData(
  position: { page?: number; cfi?: string; selector?: string; rects?: Array<{ x: number; y: number; width: number; height: number }> },
  fileType: 'epub' | 'pdf' | 'web'
): { valid: boolean; error?: ReaderError } {
  if (fileType === 'pdf') {
    if (position.page === undefined) {
      return {
        valid: false,
        error: createReaderError(ReaderErrorCodes.INVALID_POSITION_DATA, 'PDF highlight missing page number'),
      };
    }
    if (!position.rects || position.rects.length === 0) {
      return {
        valid: false,
        error: createReaderError(ReaderErrorCodes.INVALID_POSITION_DATA, 'PDF highlight missing rectangle coordinates'),
      };
    }
    // 验证 rects 格式
    for (const rect of position.rects) {
      if (
        typeof rect.x !== 'number' ||
        typeof rect.y !== 'number' ||
        typeof rect.width !== 'number' ||
        typeof rect.height !== 'number' ||
        rect.x < 0 || rect.x > 1 ||
        rect.y < 0 || rect.y > 1 ||
        rect.width <= 0 || rect.width > 1 ||
        rect.height <= 0 || rect.height > 1
      ) {
        return {
          valid: false,
          error: createReaderError(ReaderErrorCodes.INVALID_POSITION_DATA, 'PDF highlight rects out of range (must be 0-1)'),
        };
      }
    }
  } else if (fileType === 'epub') {
    if (!position.cfi || typeof position.cfi !== 'string') {
      return {
        valid: false,
        error: createReaderError(ReaderErrorCodes.INVALID_POSITION_DATA, 'EPUB highlight missing CFI'),
      };
    }
    if (!position.cfi.toLowerCase().startsWith('epubcfi')) {
      return {
        valid: false,
        error: createReaderError(ReaderErrorCodes.INVALID_POSITION_DATA, 'EPUB highlight CFI format invalid'),
      };
    }
  } else if (fileType === 'web') {
    if (!position.selector || typeof position.selector !== 'string') {
      return {
        valid: false,
        error: createReaderError(ReaderErrorCodes.INVALID_POSITION_DATA, 'Web highlight missing selector'),
      };
    }
    // 验证 selector 是有效的 JSON 或 XPath
    try {
      JSON.parse(position.selector);
    } catch {
      // 不是 JSON，可能是 XPath，基本验证通过
      if (!position.selector.startsWith('/') && !position.selector.startsWith('//')) {
        return {
          valid: false,
          error: createReaderError(ReaderErrorCodes.INVALID_POSITION_DATA, 'Web highlight selector format invalid'),
        };
      }
    }
  }

  return { valid: true };
}

