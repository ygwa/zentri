import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 全局滚动条hover效果：鼠标进入可滚动区域时显示滚动条
function setupScrollbarHover() {
  // 检查元素是否可滚动
  const isScrollable = (el: HTMLElement): boolean => {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const hasOverflow = overflowY === 'auto' || overflowY === 'scroll' || 
                        overflowX === 'auto' || overflowX === 'scroll' ||
                        overflowY === 'overlay' || overflowX === 'overlay';
    const canScroll = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
    return hasOverflow && canScroll;
  };

  // 为可滚动元素添加hover事件
  const setupElement = (el: HTMLElement) => {
    // 跳过已经设置过的元素和某些特殊元素
    if (el.dataset.scrollbarHover === 'true' || 
        el.tagName === 'SCRIPT' || 
        el.tagName === 'STYLE' ||
        el.tagName === 'NOSCRIPT') {
      return;
    }

    // 只处理可滚动元素
    if (!isScrollable(el)) {
      return;
    }
    
    el.dataset.scrollbarHover = 'true';
    
    const showScrollbar = () => {
      el.classList.add('scrollbar-hover');
    };
    
    const hideScrollbar = () => {
      el.classList.remove('scrollbar-hover');
    };
    
    el.addEventListener('mouseenter', showScrollbar, { passive: true });
    el.addEventListener('mouseleave', hideScrollbar, { passive: true });
    
    // 也监听鼠标移动，确保在滚动时也能显示
    el.addEventListener('mousemove', showScrollbar, { passive: true });
  };

  // 初始化所有现有元素（优化：只检查可能有滚动的元素）
  const initAll = () => {
    // 先检查常见的可滚动容器
    const commonSelectors = [
      'div[style*="overflow"]',
      'div[class*="scroll"]',
      'div[class*="overflow"]',
      'section[style*="overflow"]',
      'main[style*="overflow"]',
      'article[style*="overflow"]',
    ];
    
    commonSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (el instanceof HTMLElement) {
            setupElement(el);
          }
        });
      } catch (e) {
        // 忽略选择器错误
      }
    });
    
    // 然后检查所有元素（但跳过某些标签）
    document.querySelectorAll('*').forEach((el) => {
      if (el instanceof HTMLElement) {
        setupElement(el);
      }
    });
  };

  // 监听DOM变化，为新添加的元素设置hover
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          setupElement(node);
          // 也检查子元素
          node.querySelectorAll('*').forEach((child) => {
            if (child instanceof HTMLElement) {
              setupElement(child);
            }
          });
        }
      });
    });
  });

  // 初始化
  const init = () => {
    if (document.body) {
      initAll();
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// 初始化滚动条hover效果
setupScrollbarHover();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
