import { Node, mergeAttributes, InputRule, PasteRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  cards: Array<{ id: string; title: string }> | (() => Array<{ id: string; title: string }>);
  onLinkClick?: (id: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attributes: { href: string; title: string }) => ReturnType;
      insertWikiLink: (attributes: { href: string; title: string }) => ReturnType;
    };
  }
}

export function extractWikiLinkTitles(text: string): string[] {
  // This helper might need update if we store as nodes, but for plain text extraction it's still useful.
  // However, JSON content structure changes.
  // We keep it for legacy or raw text processing.
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const titles: string[] = [];
  let match;
  while ((match = wikiLinkRegex.exec(text)) !== null) {
    titles.push(match[1]);
  }
  return titles;
}

export function resolveWikiLinksToIds(titles: string[], cards: Array<{ id: string; title: string }>): string[] {
  // Same as before
  return titles.map(t => cards.find(c => c.title === t)?.id).filter(Boolean) as string[];
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: "wikiLink",
  group: "inline",
  inline: true,
  selectable: true,
  draggable: true,
  atom: true, // Atomic node

  addOptions() {
    return {
      HTMLAttributes: {
        class: "wiki-link-chip",
      },
      cards: [] as Array<{ id: string; title: string }> | (() => Array<{ id: string; title: string }>),
      onLinkClick: undefined,
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
      },
      title: {
        default: null,
      },
      exists: {
        default: false,
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="wiki-link"]',
        getAttrs: (element) => {
          if (typeof element === 'string') return {};
          return {
            href: element.getAttribute('data-href'),
            title: element.getAttribute('data-title'),
            exists: element.getAttribute('data-exists') === 'true',
          };
        }
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const isExists = node.attrs.exists;
    const title = node.attrs.title || '';
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "wiki-link",
        "data-href": node.attrs.href,
        "data-title": node.attrs.title,
        "data-exists": isExists,
        class: isExists ? 'wiki-link-chip' : 'wiki-link-chip ghost',
      }),
      // 渲染为 [[ title ]] 格式
      `[[${title}]]`,
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: /\[\[([^\]]+)\]\]/g,
        handler: ({ state, range, match }: { state: any; range: any; match: any }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;
          const title = match[1];

          if (!title) return;

          const cards = typeof this.options.cards === 'function' ? this.options.cards() : this.options.cards;
          const card = cards.find((c: any) => c.title === title);
          const exists = !!card;
          const href = card?.id || null;

          tr.replaceWith(start, end, this.type.create({
            title,
            href,
            exists
          }));
        },
      }),
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;
          const title = match[1];

          if (!title) return;

          const cards = typeof this.options.cards === 'function' ? this.options.cards() : this.options.cards;
          const card = cards.find((c: any) => c.title === title);
          const exists = !!card;
          const href = card?.id || null;

          tr.replaceWith(start, end, this.type.create({
            title,
            href,
            exists
          }));
        },
      }),
    ];
  },

  addCommands() {
    return {
      setWikiLink: (attributes: { href: string; title: string }) => ({ state, dispatch }) => {
        const { selection } = state;
        const { from, to } = selection;
        
        // 查找卡片以确定 exists 状态
        const cards = typeof this.options.cards === 'function' ? this.options.cards() : this.options.cards;
        const card = cards.find((c: any) => c.id === attributes.href || c.title === attributes.title);
        const exists = !!card;
        
        const node = this.type.create({
          title: attributes.title,
          href: attributes.href,
          exists
        });
        
        if (dispatch) {
          const tr = state.tr.replaceWith(from, to, node);
          dispatch(tr);
        }
        
        return true;
      },
      insertWikiLink: (attributes: { href: string; title: string }) => ({ state, dispatch }) => {
        // 查找卡片以确定 exists 状态
        const cards = typeof this.options.cards === 'function' ? this.options.cards() : this.options.cards;
        const card = cards.find((c: any) => c.id === attributes.href || c.title === attributes.title);
        const exists = !!card;
        
        const node = this.type.create({
          title: attributes.title,
          href: attributes.href,
          exists
        });
        
        if (dispatch) {
          const { selection } = state;
          const { from } = selection;
          const tr = state.tr.insert(from, node);
          dispatch(tr);
        }
        
        return true;
      }
    };
  },

  addProseMirrorPlugins() {
    const { onLinkClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey('wikiLinkClick'),
        props: {
          handleClick: (view, _pos, event) => {
            const target = event.target as HTMLElement;
            
            // 点击链接本身，在侧边栏预览（不跳转）
            const chip = target.closest('.wiki-link-chip');
            if (chip && onLinkClick) {
              event.preventDefault();
              event.stopPropagation();
              
              // 清除选择，避免触发 bubble toolbar
              const { state, dispatch } = view;
              // 创建一个空选择，确保不会触发 toolbar
              const Selection = state.selection.constructor as any;
              const emptySelection = Selection.create(state.doc, state.selection.$anchor.pos);
              const tr = state.tr.setSelection(emptySelection);
              dispatch(tr);
              
              const href = chip.getAttribute('data-href');
              if (href) {
                // 延迟调用，确保选择已清除
                setTimeout(() => {
                  onLinkClick(href);
                }, 0);
                return true;
              }
            }
            return false;
          }
        }
      })
    ]
  }
});
