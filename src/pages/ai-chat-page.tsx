import { AIChat } from "@/components/ai/ai-chat";

export function AIChatPage() {
    return (
        <div className="flex-1 flex flex-col h-full bg-[#f4f4f5] animate-in fade-in duration-200">
            <div className="h-12 border-b border-zinc-200 flex items-center px-6 shrink-0 bg-white">
                <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide flex items-center gap-2">
                    <span className="text-zinc-500">AI</span> 聊天
                </h2>
            </div>
            <div className="flex-1 p-6 overflow-hidden">
                <div className="h-full max-w-4xl mx-auto">
                    <AIChat className="h-full" />
                </div>
            </div>
        </div>
    );
}

