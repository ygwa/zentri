/**
 * 简单的 Markdown 解析器
 * 将 Markdown 文本转换为 HTML，用于编辑器粘贴功能
 */

/**
 * 检测文本是否包含 Markdown 特征
 */
export function looksLikeMarkdown(text: string): boolean {
  const patterns = [
    /^#{1,6}\s+\S/m,           // 标题 # ## ###
    /^\s*[-*+]\s+\S/m,         // 无序列表
    /^\s*\d+\.\s+\S/m,         // 有序列表
    /^\s*>\s+\S/m,             // 引用
    /```[\s\S]*?```/,          // 代码块
    /`[^`\n]+`/,               // 行内代码
    /\*\*[^*\n]+\*\*/,         // 加粗 **text**
    /__[^_\n]+__/,             // 加粗 __text__
    /(?<!\*)\*[^*\n]+\*(?!\*)/, // 斜体 *text*
    /(?<!_)_[^_\n]+_(?!_)/,    // 斜体 _text_
    /\[.+?\]\(.+?\)/,          // 链接 [text](url)
    /!\[.*?\]\(.+?\)/,         // 图片 ![alt](url)
    /^\s*[-*_]{3,}\s*$/m,      // 分隔线
    /^\s*-\s*\[[ x]\]/mi,      // 任务列表
  ];
  
  return patterns.some(p => p.test(text));
}

/**
 * 将 Markdown 转换为 HTML
 * 这是一个简化版本，支持常用的 Markdown 语法
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // 转义 HTML 特殊字符（但保留我们要转换的 Markdown 符号）
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // 代码块 (必须最先处理，避免内部内容被其他规则影响)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escapedCode = code.trim();
    return `<pre><code class="language-${lang || 'plaintext'}">${escapedCode}</code></pre>`;
  });
  
  // 行内代码
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  
  // 标题
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  
  // 分隔线
  html = html.replace(/^\s*[-*_]{3,}\s*$/gm, '<hr>');
  
  // 加粗和斜体 (顺序重要)
  html = html.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/___([^_\n]+)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');
  
  // 删除线
  html = html.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  
  // 高亮
  html = html.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  
  // 引用块
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  // 合并连续的引用块
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');
  
  // 任务列表
  html = html.replace(/^\s*-\s*\[x\]\s+(.+)$/gim, '<li data-type="taskItem" data-checked="true">$1</li>');
  html = html.replace(/^\s*-\s*\[\s\]\s+(.+)$/gim, '<li data-type="taskItem" data-checked="false">$1</li>');
  
  // 无序列表
  html = html.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>');
  
  // 有序列表
  html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
  
  // 将连续的 <li> 包装成 <ul> 或 <ol>
  // 简化处理：将所有连续的 li 包装成 ul
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, (match) => {
    if (match.includes('data-type="taskItem"')) {
      return `<ul data-type="taskList">${match}</ul>`;
    }
    return `<ul>${match}</ul>`;
  });
  
  // 段落：将剩余的文本行包装成段落
  // 先分割成块
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    
    // 如果已经是 HTML 标签开头，不包装
    if (/^<(h[1-6]|p|ul|ol|li|blockquote|pre|hr|div|table)/i.test(block)) {
      return block;
    }
    
    // 处理单行换行为 <br>
    block = block.replace(/\n/g, '<br>');
    
    return `<p>${block}</p>`;
  }).join('\n');
  
  return html;
}






