import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  cards: Array<{ id: string; title: string }>;
  onLinkClick?: (id: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attributes: { href: string; title: string }) => ReturnType;
      unsetWikiLink: () => ReturnType;
    };
  }
}

/**
 * 从文档内容中提取所有 [[双链]] 的标题
 */
export function extractWikiLinkTitles(text: string): string[] {
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const titles: string[] = [];
  let match;
  
  while ((match = wikiLinkRegex.exec(text)) !== null) {
    const title = match[1].trim();
    if (title && !titles.includes(title)) {
      titles.push(title);
    }
  }
  
  return titles;
}

/**
 * 根据标题列表和卡片列表，返回匹配的卡片 ID 列表
 */
export function resolveWikiLinksToIds(
  titles: string[],
  cards: Array<{ id: string; title: string }>
): string[] {
  const ids: string[] = [];
  
  for (const title of titles) {
    const card = cards.find(c => c.title === title);
    if (card && !ids.includes(card.id)) {
      ids.push(card.id);
    }
  }
  
  return ids;
}

export const WikiLink = Mark.create<WikiLinkOptions>({
  name: "wikiLink",

  addOptions() {
    return {
      HTMLAttributes: {
        class: "wiki-link",
      },
      cards: [],
      onLinkClick: undefined,
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-href"),
        renderHTML: (attributes) => {
          if (!attributes.href) return {};
          return { "data-href": attributes.href };
        },
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes) => {
          if (!attributes.title) return {};
          return { "data-title": attributes.title };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="wiki-link"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "wiki-link",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetWikiLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  // 添加插件来处理 [[link]] 语法
  addProseMirrorPlugins() {
    const { onLinkClick, cards } = this.options;
    
    // 构建标题到卡片的 Map，加速查找
    const cardsByTitle = new Map<string, { id: string; title: string }>();
    cards.forEach(card => {
      cardsByTitle.set(card.title, card);
    });

    return [
      new Plugin({
        key: new PluginKey("wikiLinkHandler"),
        props: {
          // 处理点击事件
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;
            if (target.classList.contains("wiki-link")) {
              const href = target.getAttribute("data-href");
              if (href && onLinkClick) {
                event.preventDefault();
                onLinkClick(href);
                return true;
              }
            }
            return false;
          },
          // 装饰器：渲染 [[link]] 为可点击的链接样式
          decorations(state) {
            const decorations: Decoration[] = [];
            const { doc } = state;

            // 只匹配 [[title]] 格式
            const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              let match;
              while ((match = wikiLinkRegex.exec(node.text)) !== null) {
                const start = pos + match.index;
                const end = start + match[0].length;
                
                const title = match[1].trim();
                
                // 使用 Map 快速查找
                const card = cardsByTitle.get(title);
                const linkId = card?.id || "";
                const exists = !!card;

                // 两种状态的样式类：
                // 1. wiki-link: 存在的卡片（可点击打开）
                // 2. wiki-link wiki-link-ghost: 不存在的卡片（可点击创建）
                const className = exists ? "wiki-link" : "wiki-link wiki-link-ghost";
                const titleText = exists ? `点击打开: ${title}` : `点击创建: ${title}`;

                decorations.push(
                  Decoration.inline(start, end, {
                    class: className,
                    "data-href": linkId,
                    "data-title": title,
                    "data-exists": exists ? "true" : "false",
                    title: titleText,
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
