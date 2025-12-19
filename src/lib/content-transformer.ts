import { JSONContent } from "@tiptap/core";

export function transformTextToWikiLinks(content: JSONContent): JSONContent {
    if (!content) return content;

    if (content.type === "text" && content.text) {
        const regex = /\[\[([^\]]+)\]\]/g;
        const text = content.text;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Push preceding text
            if (match.index > lastIndex) {
                parts.push({
                    type: "text",
                    text: text.slice(lastIndex, match.index),
                    marks: content.marks, // Preserve marks
                });
            }

            // Push WikiLink Node
            parts.push({
                type: "wikiLink",
                attrs: {
                    title: match[1],
                    href: null, // Will be resolved by the editor/extension logic if needed, or we can resolve if we have cards
                    exists: false // Default, logic should update this
                },
            });

            lastIndex = regex.lastIndex;
        }

        // Push remaining text
        if (lastIndex < text.length) {
            parts.push({
                type: "text",
                text: text.slice(lastIndex),
                marks: content.marks,
            });
        }

        // If no matches, return original
        if (parts.length === 0) return content;

        // If only one match and it covers the whole text? 
        // Wait, transformTextToWikiLinks is expected to return a single node?
        // No, if we split a text node, we need to return an ARRAY of nodes.
        // But we are traversing a tree.
        // This helper needs to be used in a traversal context.

        // Actually, it's easier to write a traversal function.
    }

    return content;
}

export function preprocessContent(content: JSONContent): JSONContent {
    if (!content) return content;

    // console.log("preprocessContent processing node:", content.type);

    if (Array.isArray(content.content)) {
        const newContent: JSONContent[] = [];
        content.content.forEach(child => {
            if (child.type === 'text' && child.text && child.text.includes('[[')) {
                // console.log("preprocessContent found wikilink in text:", child.text);
                const regex = /\[\[([^\]]+)\]\]/g;
                const text = child.text;
                let lastIndex = 0;
                let match;

                while ((match = regex.exec(text)) !== null) {
                    if (match.index > lastIndex) {
                        newContent.push({
                            type: "text",
                            text: text.slice(lastIndex, match.index),
                            marks: child.marks,
                        });
                    }

                    newContent.push({
                        type: "wikiLink",
                        attrs: {
                            title: match[1],
                            href: match[1], // Use title as ID/Href initially
                            exists: true // Assume true or let UI handle ghost state
                        },
                    });

                    lastIndex = regex.lastIndex;
                }

                if (lastIndex < text.length) {
                    newContent.push({
                        type: "text",
                        text: text.slice(lastIndex),
                        marks: child.marks,
                    });
                }
            } else {
                newContent.push(preprocessContent(child));
            }
        });
        return { ...content, content: newContent };
    }

    return content;
}
