import { 
  Undo, Redo, Bold, Italic, Strikethrough, Code, 
  Heading1, Heading2, List, ListOrdered, Quote, Image as ImageIcon 
} from "lucide-react";
import type { Editor } from "@tiptap/react";

interface TiptapToolbarProps {
  editor?: Editor | null;
}

export function TiptapToolbar({ editor }: TiptapToolbarProps) {
  const handleCommand = (command: () => void) => {
    if (editor) {
      command();
    }
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-white border border-zinc-200 rounded-md shadow-sm mb-4 mx-auto w-fit sticky top-2 z-10 animate-in slide-in-from-top-2 fade-in duration-300">
      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5 border-r border-zinc-200 pr-1 mr-1">
        <button 
          className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-sm hover:text-black transition-colors" 
          title="Undo"
          onClick={() => handleCommand(() => editor?.chain().focus().undo().run())}
          disabled={!editor?.can().undo()}
        >
          <Undo size={14}/>
        </button>
        <button 
          className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded-sm hover:text-black transition-colors" 
          title="Redo"
          onClick={() => handleCommand(() => editor?.chain().focus().redo().run())}
          disabled={!editor?.can().redo()}
        >
          <Redo size={14}/>
        </button>
      </div>

      {/* Text Formatting */}
      <div className="flex items-center gap-0.5 border-r border-zinc-200 pr-1 mr-1">
        <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('bold') ? 'bg-zinc-200 text-zinc-900 font-bold' : 'text-zinc-700'
          }`}
          title="Bold"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleBold().run())}
        >
          <Bold size={14}/>
        </button>
        <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('italic') ? 'bg-zinc-200 text-zinc-900 italic' : 'text-zinc-700'
          }`}
          title="Italic"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleItalic().run())}
        >
          <Italic size={14}/>
        </button>
        {/* Underline - TipTap StarterKit 默认不包含，暂时隐藏 */}
        {/* <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('underline') ? 'bg-zinc-200 text-zinc-900 underline' : 'text-zinc-700'
          }`}
          title="Underline"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleUnderline().run())}
        >
          <Underline size={14}/>
        </button> */}
        <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('strike') ? 'bg-zinc-200 text-zinc-900 line-through' : 'text-zinc-700'
          }`}
          title="Strike"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleStrike().run())}
        >
          <Strikethrough size={14}/>
        </button>
        <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('code') ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-700'
          }`}
          title="Code"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleCode().run())}
        >
          <Code size={14}/>
        </button>
      </div>

      {/* Block Formatting */}
      <div className="flex items-center gap-0.5">
        <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('heading', { level: 1 }) ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-700'
          }`}
          title="H1"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}
        >
          <Heading1 size={14}/>
        </button>
        <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('heading', { level: 2 }) ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-700'
          }`}
          title="H2"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
        >
          <Heading2 size={14}/>
        </button>
        <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('bulletList') ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-700'
          }`}
          title="List"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleBulletList().run())}
        >
          <List size={14}/>
        </button>
        <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('orderedList') ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-700'
          }`}
          title="Ordered List"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleOrderedList().run())}
        >
          <ListOrdered size={14}/>
        </button>
        <button 
          className={`p-1.5 rounded-sm hover:bg-zinc-100 hover:text-black transition-colors ${
            editor?.isActive('blockquote') ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-700'
          }`}
          title="Quote"
          onClick={() => handleCommand(() => editor?.chain().focus().toggleBlockquote().run())}
        >
          <Quote size={14}/>
        </button>
        <button 
          className="p-1.5 text-zinc-700 hover:bg-zinc-100 rounded-sm hover:text-black transition-colors" 
          title="Image"
          onClick={() => {
            // TODO: 实现图片插入功能
            console.log("Insert image");
          }}
        >
          <ImageIcon size={14}/>
        </button>
      </div>
    </div>
  );
}

