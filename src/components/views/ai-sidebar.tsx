import { useState, useEffect } from "react";
import { Sparkles, Loader2, Send, MessageSquare, BookOpen, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as api from "@/services/api";
import { cn } from "@/lib/utils";

interface AISidebarProps {
  cardId: string;
  cardTitle?: string;
  cardContent?: string;
  selectedText?: string;
  className?: string;
}

export function AISidebar({ cardId: _cardId, cardTitle, cardContent: _cardContent, selectedText, className }: AISidebarProps) {
  const [serverStatus, setServerStatus] = useState<{ running: boolean; port: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'explain' | 'rag'>('chat');
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [explainText, setExplainText] = useState(selectedText || "");
  const [explainResult, setExplainResult] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResult, setRagResult] = useState<string | null>(null);
  const [ragLoading, setRagLoading] = useState(false);

  // 检查服务器状态
  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // 当选中文本变化时，更新解释文本
  useEffect(() => {
    if (selectedText) {
      setExplainText(selectedText);
      if (activeTab === 'explain') {
        setExplainResult(null);
      }
    }
  }, [selectedText, activeTab]);

  const checkServerStatus = async () => {
    try {
      const status = await api.ai.checkStatus();
      setServerStatus({ running: status.running, port: status.port });
    } catch (error) {
      console.error("Failed to check server status:", error);
      setServerStatus({ running: false, port: 8080 });
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading || !serverStatus?.running) return;

    const userMessage = { role: 'user' as const, content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await api.ai.chat([...chatMessages, userMessage]);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `错误: ${error instanceof Error ? error.message : "未知错误"}`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!explainText.trim() || explainLoading || !serverStatus?.running) return;

    setExplainLoading(true);
    setExplainResult(null);

    try {
      const context = cardTitle ? `当前笔记标题：${cardTitle}` : undefined;
      const result = await api.ai.explainText(explainText.trim(), context);
      setExplainResult(result);
    } catch (error) {
      console.error("Explain error:", error);
      setExplainResult(`错误: ${error instanceof Error ? error.message : "无法获取 AI 解释"}`);
    } finally {
      setExplainLoading(false);
    }
  };

  const handleRAGQuery = async () => {
    if (!ragQuery.trim() || ragLoading || !serverStatus?.running) return;

    setRagLoading(true);
    setRagResult(null);

    try {
      // 使用当前卡片的 sourceId（如果有）进行 RAG 查询
      const result = await api.ai.ragQuery(ragQuery.trim());
      setRagResult(result);
    } catch (error) {
      console.error("RAG query error:", error);
      setRagResult(`错误: ${error instanceof Error ? error.message : "无法执行 RAG 查询"}`);
    } finally {
      setRagLoading(false);
    }
  };

  if (!serverStatus?.running) {
    return (
      <div className={cn("flex flex-col h-full p-4", className)}>
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-3 text-zinc-400" />
          <p className="text-sm font-medium mb-1">AI 服务器未运行</p>
          <p className="text-xs text-zinc-500">
            请在设置中启动 AI 服务器并选择模型
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 标签页切换 */}
      <div className="flex items-center border-b border-zinc-200 bg-white px-2">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            "flex-1 px-3 py-2 text-xs font-medium transition-colors relative",
            activeTab === 'chat'
              ? "text-blue-600"
              : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />
          聊天
          {activeTab === 'chat' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('explain')}
          className={cn(
            "flex-1 px-3 py-2 text-xs font-medium transition-colors relative",
            activeTab === 'explain'
              ? "text-blue-600"
              : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          <Zap className="h-3.5 w-3.5 inline mr-1.5" />
          解释
          {activeTab === 'explain' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('rag')}
          className={cn(
            "flex-1 px-3 py-2 text-xs font-medium transition-colors relative",
            activeTab === 'rag'
              ? "text-blue-600"
              : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          <BookOpen className="h-3.5 w-3.5 inline mr-1.5" />
          检索
          {activeTab === 'rag' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-6 w-6 mx-auto mb-2 text-zinc-400" />
                    <p className="text-xs">开始与 AI 对话...</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-900"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-100 rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-zinc-200">
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                  placeholder="输入消息..."
                  className="flex-1 min-h-[60px] text-xs resize-none"
                  disabled={chatLoading}
                />
                <Button
                  onClick={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                  size="icon"
                  className="h-[60px] shrink-0"
                >
                  {chatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'explain' && (
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
                  待解释文本
                </label>
                <Textarea
                  value={explainText}
                  onChange={(e) => setExplainText(e.target.value)}
                  placeholder="输入或选择要解释的文本..."
                  className="min-h-[100px] text-xs resize-none"
                  disabled={explainLoading}
                />
              </div>
              <Button
                onClick={handleExplain}
                disabled={!explainText.trim() || explainLoading}
                size="sm"
                className="w-full"
              >
                {explainLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    解释中...
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 mr-2" />
                    解释文本
                  </>
                )}
              </Button>
              {explainResult && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs font-medium text-blue-900 mb-2">AI 解释</div>
                  <div className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                    {explainResult}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rag' && (
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
                  检索查询
                </label>
                <Textarea
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  placeholder="输入查询问题，AI 将在知识库中检索相关内容..."
                  className="min-h-[100px] text-xs resize-none"
                  disabled={ragLoading}
                />
              </div>
              <Button
                onClick={handleRAGQuery}
                disabled={!ragQuery.trim() || ragLoading}
                size="sm"
                className="w-full"
              >
                {ragLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    检索中...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-3.5 w-3.5 mr-2" />
                    检索知识库
                  </>
                )}
              </Button>
              {ragResult && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-xs font-medium text-emerald-900 mb-2">检索结果</div>
                  <div className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                    {ragResult}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

