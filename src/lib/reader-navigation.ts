/**
 * 阅读器导航系统
 * 用于在笔记编辑器中的引用块和阅读器之间建立跳转链接
 */

export interface NavigationTarget {
  sourceId: string;
  type: 'pdf' | 'epub' | 'webpage';
  // PDF 定位
  page?: number;
  // EPUB 定位
  cfi?: string;
  // 网页定位
  selector?: string;
}

type NavigationHandler = (target: NavigationTarget) => void;

class ReaderNavigationManager {
  private handlers: Set<NavigationHandler> = new Set();

  /**
   * 注册导航处理器
   */
  subscribe(handler: NavigationHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * 触发导航到指定位置
   */
  navigateTo(target: NavigationTarget): void {
    this.handlers.forEach(handler => {
      try {
        handler(target);
      } catch (err) {
        console.error('Navigation handler error:', err);
      }
    });
  }

  /**
   * 快捷方法：跳转到 PDF 页面
   */
  goToPdfPage(sourceId: string, page: number): void {
    this.navigateTo({ sourceId, type: 'pdf', page });
  }

  /**
   * 快捷方法：跳转到 EPUB CFI
   */
  goToEpubCfi(sourceId: string, cfi: string): void {
    this.navigateTo({ sourceId, type: 'epub', cfi });
  }

  /**
   * 快捷方法：跳转到网页位置
   */
  goToWebSelector(sourceId: string, selector: string): void {
    this.navigateTo({ sourceId, type: 'webpage', selector });
  }
}

// 全局单例
export const readerNavigation = new ReaderNavigationManager();

/**
 * 从引用块属性创建导航目标
 */
export function createNavigationTarget(attrs: {
  sourceId: string;
  sourceType?: string;
  page?: number;
  cfi?: string;
  selector?: string;
}): NavigationTarget {
  const type = (attrs.sourceType as 'pdf' | 'epub' | 'webpage') || 'pdf';
  
  return {
    sourceId: attrs.sourceId,
    type,
    page: attrs.page,
    cfi: attrs.cfi,
    selector: attrs.selector,
  };
}






